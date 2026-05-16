import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe/server";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { paymentReceipt, paymentFailed, instructorPaymentNotification, eventBookingConfirmation, eventBookingConfirmedFull, eventBookingConfirmedInstallment, ownerNewBookingNotification, memberPaymentSuccessOwnerNotice, memberPaymentFailedOwnerNotice } from "@/lib/email/templates";
import { insertWebhookLog } from "@/lib/admin/logs";
import { recordDiscountRedemption } from "@/lib/discounts/apply";

/** session.subscription は string | Subscription (expand時) のため、必ずID文字列を返す */
function getSubscriptionId(sub: string | Stripe.Subscription | null): string | null {
  return sub == null ? null : typeof sub === "string" ? sub : sub.id;
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  let adminSupabase: SupabaseClient | null = null;
  let eventId: string | null = null;

  try {
    const sig = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return NextResponse.json(
        { error: "Missing signature or webhook secret" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      eventId = event.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid signature";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const connectedAccountId = (event as Stripe.Event & { account?: string })
      .account;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        let studioId = session.metadata?.studio_id as string | undefined;

        if (connectedAccountId) {
          // Check if this is an instructor direct payout
          const payoutModel = session.metadata?.payout_model as string | undefined;
          if (payoutModel === "instructor_direct") {
            await handleInstructorDirectPayout(
              session,
              connectedAccountId,
              adminSupabase
            );
            break;
          }

          // インストラクターメンバーシップ課金
          const metaType = session.metadata?.type as string | undefined;
          if (metaType === "instructor_membership") {
            await handleInstructorMembershipCheckout(
              session,
              adminSupabase
            );
            break;
          }

          // イベント予約の決済完了
          if (metaType === "event_booking") {
            await handleEventBookingCheckout(session, adminSupabase);
            break;
          }

          // パスサブスクリプションの購入完了
          if (metaType === "studio_pass") {
            await handlePassSubscriptionCheckout(session, adminSupabase);
            break;
          }

          const { data: studio } = await adminSupabase
            .from("studios")
            .select("id")
            .eq("stripe_connect_account_id", connectedAccountId)
            .single();
          if (!studio) break;
          studioId = studio.id;
        }

        const productId = session.metadata?.product_id as string | undefined;
        const memberId = session.metadata?.member_id as string | undefined;
        const creditsStr = session.metadata?.credits as string | undefined;

        if (productId && memberId && studioId) {
          const credits = parseInt(creditsStr ?? "0", 10);
          const amount = session.amount_total ?? 0;

          await adminSupabase.from("payments").insert({
            studio_id: studioId,
            member_id: memberId,
            product_id: productId,
            amount,
            currency: session.currency ?? "usd",
            type: "product_purchase",
            status: "paid",
            stripe_payment_intent_id: session.payment_intent as string | null,
            payment_type: productId,
            paid_at: new Date().toISOString(),
          });

          if (credits === -1) {
            const subscriptionId = getSubscriptionId(session.subscription as string | Stripe.Subscription | null);
            await adminSupabase
              .from("members")
              .update({
                plan_type: "subscription",
                credits: -1,
                stripe_subscription_id: subscriptionId,
              })
              .eq("id", memberId);
          } else if (credits > 0) {
            const { data: m } = await adminSupabase
              .from("members")
              .select("credits")
              .eq("id", memberId)
              .single();
            const current = m?.credits ?? 0;
            if (current === -1) {
              // Already unlimited — skip credit addition
            } else {
              const next = Math.max(0, current) + credits;
              await adminSupabase
                .from("members")
                .update({ credits: next })
                .eq("id", memberId);
            }
          }

          const [{ data: memberProfile }, { data: studioData }, { data: productRow }] = await Promise.all([
            adminSupabase.from("members").select("profiles(full_name, email)").eq("id", memberId).single(),
            adminSupabase.from("studios").select("name").eq("id", studioId).single(),
            adminSupabase.from("products").select("name").eq("id", productId).single(),
          ]);
          const memberProf = (memberProfile as { profiles?: { full_name?: string; email?: string } })?.profiles;
          const prof = Array.isArray(memberProf) ? memberProf[0] : memberProf;
          const toEmail = prof?.email;
          const memberName = prof?.full_name ?? "Member";
          const studioName = studioData?.name ?? "Studio";
          const productName = (productRow as { name?: string } | null)?.name ?? "Purchase";

          if (toEmail) {
            const { subject, html } = paymentReceipt({
              memberName,
              amount,
              description: productName,
              studioName,
            });
            await sendEmail({
              to: toEmail,
              subject,
              html,
              studioId,
              templateName: "payment_receipt",
            });
          }
          break;
        }

        if (connectedAccountId) break;

        const subscriptionId = getSubscriptionId(session.subscription as string | Stripe.Subscription | null);
        if (!studioId || !subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId
        );
        const priceId = subscription.items.data[0]?.price?.id ?? "";
        const period: "monthly" | "yearly" =
          priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID ? "yearly" : "monthly";

        const trialEnd = subscription.trial_end;
        const trialEndAt = trialEnd
          ? new Date(trialEnd * 1000).toISOString()
          : null;

        const periodEnd = subscription.items.data[0]?.current_period_end;
        const currentPeriodEnd = periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null;

        await adminSupabase
          .from("studios")
          .update({
            stripe_subscription_id: subscriptionId,
            plan: "pro",
            plan_status: "trialing",
            trial_ends_at: trialEndAt,
            subscription_period: period,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          })
          .eq("id", studioId);

        // Stripe checkout でプロモコードが使用された場合に redemption を記録
        const discounts = session.discounts as Array<{ promotion_code?: string | { id: string } | null }> | null;
        if (discounts && discounts.length > 0) {
          const stripePromoId =
            typeof discounts[0].promotion_code === "string"
              ? discounts[0].promotion_code
              : discounts[0].promotion_code?.id ?? null;

          if (stripePromoId) {
            const { data: promoRow } = await adminSupabase
              .from("promotion_codes")
              .select("id, coupon_id, times_redeemed")
              .eq("stripe_promo_id", stripePromoId)
              .maybeSingle();

            if (promoRow) {
              await Promise.all([
                adminSupabase.from("coupon_redemptions").insert({
                  studio_id: studioId,
                  coupon_id: promoRow.coupon_id,
                  promotion_code_id: promoRow.id,
                  stripe_subscription_id: subscriptionId,
                }),
                adminSupabase
                  .from("promotion_codes")
                  .update({ times_redeemed: (promoRow.times_redeemed ?? 0) + 1 })
                  .eq("id", promoRow.id),
              ]);
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        // パスサブスクリプションの更新チェック
        const { data: passSubUpdate } = await adminSupabase
          .from("pass_subscriptions")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (passSubUpdate) {
          const periodStart = subscription.items.data[0]?.current_period_start;
          const periodEnd = subscription.items.data[0]?.current_period_end;
          const passStatus = subscription.status === "active" || subscription.status === "trialing"
            ? "active"
            : subscription.status === "past_due" || subscription.status === "incomplete" || subscription.status === "unpaid"
              ? "past_due"
              : "cancelled";

          // Check if the pass has a fixed expires_on — if so, don't overwrite current_period_end
          const { data: passSubFull } = await adminSupabase
            .from("pass_subscriptions")
            .select("studio_pass_id, studio_passes(expires_on)")
            .eq("id", passSubUpdate.id)
            .single();
          const fixedExpiresOn = (passSubFull?.studio_passes as { expires_on?: string } | null)?.expires_on;

          const updateData: Record<string, unknown> = {
            status: passStatus,
            current_period_start: periodStart ? new Date(periodStart * 1000).toISOString().slice(0, 10) : null,
            current_period_end: fixedExpiresOn
              ? fixedExpiresOn
              : periodEnd ? new Date(periodEnd * 1000).toISOString().slice(0, 10) : null,
          };
          // Reset classes_used_this_period on new billing period
          if (periodStart) {
            const newStart = new Date(periodStart * 1000).toISOString().slice(0, 10);
            const { data: currentSub } = await adminSupabase
              .from("pass_subscriptions")
              .select("current_period_start")
              .eq("id", passSubUpdate.id)
              .single();
            if (currentSub && currentSub.current_period_start !== newStart) {
              updateData.classes_used_this_period = 0;
            }
          }
          await adminSupabase
            .from("pass_subscriptions")
            .update(updateData)
            .eq("id", passSubUpdate.id);
          break;
        }

        // インストラクターメンバーシップのサブスク更新チェック
        const { data: instrMembership } = await adminSupabase
          .from("instructor_memberships")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (instrMembership) {
          const periodEnd = subscription.items.data[0]?.current_period_end;
          await adminSupabase
            .from("instructor_memberships")
            .update({
              status: subscription.status === "active" || subscription.status === "trialing" ? "active" : "cancelled",
              current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
              cancel_at_period_end: subscription.cancel_at_period_end ?? false,
            })
            .eq("id", instrMembership.id);
          break;
        }

        const { data: studio } = await adminSupabase
          .from("studios")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (!studio) break;

        const status = subscription.status;
        const priceId = subscription.items.data[0]?.price?.id ?? "";
        const period: "monthly" | "yearly" =
          priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID ? "yearly" : "monthly";
        const periodEnd = subscription.items.data[0]?.current_period_end;
        const currentPeriodEnd = periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null;

        let planStatus = "trialing";
        let gracePeriodEndsAt: string | null = null;

        if (status === "active") {
          planStatus = "active";
        } else if (status === "past_due") {
          planStatus = "past_due";
          const in14Days = new Date();
          in14Days.setDate(in14Days.getDate() + 14);
          gracePeriodEndsAt = in14Days.toISOString();
        } else if (status === "trialing") {
          planStatus = "trialing";
        }

        await adminSupabase
          .from("studios")
          .update({
            plan_status: planStatus,
            subscription_period: period,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
            grace_period_ends_at: gracePeriodEndsAt,
          })
          .eq("id", studio.id);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subscriptionId =
          typeof subRef === "string" ? subRef : subRef?.id ?? null;

        if (!subscriptionId) break;

        // ── パスサブスクリプションの支払い成功 ──
        const { data: passSubPaid } = await adminSupabase
          .from("pass_subscriptions")
          .select("id, member_id, studio_id, studio_passes(name)")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (passSubPaid) {
          await adminSupabase
            .from("pass_subscriptions")
            .update({ status: "active" })
            .eq("id", passSubPaid.id);

          await adminSupabase.from("payments").insert({
            studio_id: passSubPaid.studio_id,
            member_id: passSubPaid.member_id,
            amount: invoice.amount_paid,
            currency: invoice.currency ?? "usd",
            type: "monthly",
            status: "paid",
            stripe_invoice_id: invoice.id,
            payment_type: "pass_subscription",
            paid_at: new Date().toISOString(),
          });

          const [{ data: passStudio }, { data: passMemberProf }, { data: passOwnerPaid }] = await Promise.all([
            adminSupabase.from("studios").select("name").eq("id", passSubPaid.studio_id).single(),
            adminSupabase.from("members").select("profiles(full_name, email)").eq("id", passSubPaid.member_id).single(),
            adminSupabase.from("profiles").select("full_name, email").eq("studio_id", passSubPaid.studio_id).eq("role", "owner").limit(1).single(),
          ]);
          const passStudioName = passStudio?.name ?? "Studio";
          const passName = (passSubPaid.studio_passes as { name?: string } | null)?.name ?? "Pass subscription";
          const pmp = (passMemberProf as { profiles?: { full_name?: string; email?: string } })?.profiles;
          const pmpf = Array.isArray(pmp) ? pmp[0] : pmp;

          if (pmpf?.email) {
            const receipt = paymentReceipt({ memberName: pmpf.full_name ?? "Member", amount: invoice.amount_paid, description: passName, studioName: passStudioName });
            await sendEmail({ to: pmpf.email, subject: receipt.subject, html: receipt.html, studioId: passSubPaid.studio_id, templateName: "payment_receipt" });
          }
          if (passOwnerPaid?.email) {
            const notice = memberPaymentSuccessOwnerNotice({
              ownerName: passOwnerPaid.full_name ?? "Studio Owner",
              memberName: pmpf?.full_name ?? "Member",
              memberEmail: pmpf?.email ?? "",
              amount: invoice.amount_paid,
              description: passName,
              studioName: passStudioName,
            });
            await sendEmail({ to: passOwnerPaid.email, subject: notice.subject, html: notice.html, studioId: passSubPaid.studio_id, templateName: "member_payment_success_owner_notice" });
          }
          break;
        }

        // ── インストラクターメンバーシップの支払い成功 ──
        const { data: instrMemPaid } = await adminSupabase
          .from("instructor_memberships")
          .select("id, instructor_id, studio_id, instructor_membership_tiers(name)")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (instrMemPaid) {
          await adminSupabase.from("payments").insert({
            studio_id: instrMemPaid.studio_id,
            amount: invoice.amount_paid,
            currency: invoice.currency ?? "usd",
            type: "monthly",
            status: "paid",
            stripe_invoice_id: invoice.id,
            payment_type: "instructor_membership",
            paid_at: new Date().toISOString(),
          });

          const [{ data: instrStudio }, { data: instrProfile }, { data: instrOwnerPaid }] = await Promise.all([
            adminSupabase.from("studios").select("name").eq("id", instrMemPaid.studio_id).single(),
            adminSupabase.from("instructors").select("profiles(full_name, email)").eq("id", instrMemPaid.instructor_id).single(),
            adminSupabase.from("profiles").select("full_name, email").eq("studio_id", instrMemPaid.studio_id).eq("role", "owner").limit(1).single(),
          ]);
          const instrStudioName = instrStudio?.name ?? "Studio";
          const tierName = (instrMemPaid.instructor_membership_tiers as { name?: string } | null)?.name ?? "Instructor membership";
          const ip = (instrProfile as { profiles?: { full_name?: string; email?: string } })?.profiles;
          const ipf = Array.isArray(ip) ? ip[0] : ip;

          if (ipf?.email) {
            const receipt = paymentReceipt({ memberName: ipf.full_name ?? "Instructor", amount: invoice.amount_paid, description: tierName, studioName: instrStudioName });
            await sendEmail({ to: ipf.email, subject: receipt.subject, html: receipt.html, studioId: instrMemPaid.studio_id, templateName: "payment_receipt" });
          }
          if (instrOwnerPaid?.email) {
            const notice = memberPaymentSuccessOwnerNotice({
              ownerName: instrOwnerPaid.full_name ?? "Studio Owner",
              memberName: ipf?.full_name ?? "Instructor",
              memberEmail: ipf?.email ?? "",
              amount: invoice.amount_paid,
              description: tierName,
              studioName: instrStudioName,
            });
            await sendEmail({ to: instrOwnerPaid.email, subject: notice.subject, html: notice.html, studioId: instrMemPaid.studio_id, templateName: "member_payment_success_owner_notice" });
          }
          break;
        }

        const { data: studio } = await adminSupabase
          .from("studios")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (studio) {
          await adminSupabase
            .from("studios")
            .update({ plan_status: "active" })
            .eq("id", studio.id);

          await adminSupabase.from("payments").insert({
            studio_id: studio.id,
            member_id: null,
            amount: invoice.amount_paid,
            currency: invoice.currency ?? "usd",
            type: "subscription",
            status: "paid",
            stripe_invoice_id: invoice.id,
            payment_type: "subscription",
            paid_at: new Date().toISOString(),
          });

          const [{ data: ownerProfile }, { data: studioData }] = await Promise.all([
            adminSupabase.from("profiles").select("full_name, email").eq("studio_id", studio.id).eq("role", "owner").limit(1).single(),
            adminSupabase.from("studios").select("name").eq("id", studio.id).single(),
          ]);
          if (ownerProfile?.email) {
            const { subject, html } = paymentReceipt({
              memberName: ownerProfile.full_name ?? "Studio Owner",
              amount: invoice.amount_paid,
              description: "Pro plan subscription",
              studioName: studioData?.name ?? "Studio",
            });
            await sendEmail({
              to: ownerProfile.email,
              subject,
              html,
              studioId: studio.id,
              templateName: "payment_receipt",
            });
          }

          // ── リファーラル特典処理 ──
          try {
            const { data: studioFull } = await adminSupabase
              .from("studios")
              .select("referred_by_code, stripe_subscription_id")
              .eq("id", studio.id)
              .single();

            if (studioFull?.referred_by_code) {
              // pendingのリファーラルレコードを取得
              const { data: reward } = await adminSupabase
                .from("referral_rewards")
                .select("id, referrer_studio_id, status, referrer_reward_applied, referred_reward_applied")
                .eq("referred_studio_id", studio.id)
                .eq("status", "pending")
                .single();

              if (reward) {
                const { referralRewardReferrer, referralRewardReferred } = await import("@/lib/email/templates");

                // === 被紹介者への特典 ===
                let referredCouponId: string | null = null;
                try {
                  const coupon = await stripe.coupons.create({
                    percent_off: 100,
                    duration: "once",
                    name: "Referral Reward - 1 Month Free",
                  });
                  referredCouponId = coupon.id;

                  if (studioFull.stripe_subscription_id) {
                    await stripe.subscriptions.update(studioFull.stripe_subscription_id, {
                      discounts: [{ coupon: coupon.id }],
                    });
                  }
                } catch (couponErr) {
                  console.error("[webhook] Failed to apply referred coupon:", couponErr);
                }

                // === 紹介者への特典 ===
                let referrerCouponId: string | null = null;
                let referrerRewardApplied = false;
                const { data: referrerStudio } = await adminSupabase
                  .from("studios")
                  .select("id, name, stripe_subscription_id")
                  .eq("id", reward.referrer_studio_id)
                  .single();

                if (referrerStudio?.stripe_subscription_id) {
                  try {
                    const coupon = await stripe.coupons.create({
                      percent_off: 100,
                      duration: "once",
                      name: "Referral Reward - 1 Month Free",
                    });
                    referrerCouponId = coupon.id;

                    await stripe.subscriptions.update(referrerStudio.stripe_subscription_id, {
                      discounts: [{ coupon: coupon.id }],
                    });
                    referrerRewardApplied = true;
                  } catch (couponErr) {
                    // 紹介者のサブスクが無効な場合はスキップ（再開時に適用）
                    console.error("[webhook] Failed to apply referrer coupon:", couponErr);
                  }
                }

                // referral_rewards を更新
                await adminSupabase
                  .from("referral_rewards")
                  .update({
                    status: "completed",
                    referrer_reward_applied: referrerRewardApplied,
                    referred_reward_applied: !!referredCouponId,
                    stripe_coupon_id_referrer: referrerCouponId,
                    stripe_coupon_id_referred: referredCouponId,
                    completed_at: new Date().toISOString(),
                  })
                  .eq("id", reward.id);

                // メール通知 — 紹介者宛
                const { data: referrerOwnerProfile } = await adminSupabase
                  .from("profiles")
                  .select("email")
                  .eq("studio_id", reward.referrer_studio_id)
                  .eq("role", "owner")
                  .single();

                if (referrerOwnerProfile?.email) {
                  const email = referralRewardReferrer({
                    referrerStudioName: referrerStudio?.name ?? "Studio",
                    newStudioName: studioData?.name ?? "Studio",
                  });
                  await sendEmail({
                    to: referrerOwnerProfile.email,
                    subject: email.subject,
                    html: email.html,
                    studioId: reward.referrer_studio_id,
                    templateName: "referral_reward_referrer",
                  });
                }

                // メール通知 — 被紹介者宛
                if (ownerProfile?.email) {
                  const email = referralRewardReferred({
                    referrerStudioName: referrerStudio?.name ?? "Studio",
                    newStudioName: studioData?.name ?? "Studio",
                  });
                  await sendEmail({
                    to: ownerProfile.email,
                    subject: email.subject,
                    html: email.html,
                    studioId: studio.id,
                    templateName: "referral_reward_referred",
                  });
                }
              }
            }
          } catch (refErr) {
            // リファーラル処理失敗はWebhook全体をブロックしない
            console.error("[webhook] Referral reward processing failed:", refErr);
          }

          break;
        }

        const { data: member } = await adminSupabase
          .from("members")
          .select("id, studio_id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (member) {
          await adminSupabase.from("payments").insert({
            studio_id: member.studio_id,
            member_id: member.id,
            amount: invoice.amount_paid,
            currency: invoice.currency ?? "usd",
            type: "monthly",
            status: "paid",
            stripe_invoice_id: invoice.id,
            payment_type: "monthly",
            paid_at: new Date().toISOString(),
          });

          const [{ data: prof }, { data: studioData }, { data: ownerForMemberPaid }] = await Promise.all([
            adminSupabase.from("members").select("profiles(full_name, email)").eq("id", member.id).single(),
            adminSupabase.from("studios").select("name").eq("id", member.studio_id).single(),
            adminSupabase.from("profiles").select("full_name, email").eq("studio_id", member.studio_id).eq("role", "owner").limit(1).single(),
          ]);
          const p = (prof as { profiles?: { full_name?: string; email?: string } })?.profiles;
          const pf = Array.isArray(p) ? p[0] : p;
          const memberName = pf?.full_name ?? "Member";
          const memberEmail = pf?.email ?? "";
          const studioName = studioData?.name ?? "Studio";

          if (memberEmail) {
            const { subject, html } = paymentReceipt({
              memberName,
              amount: invoice.amount_paid,
              description: "Monthly membership",
              studioName,
            });
            await sendEmail({
              to: memberEmail,
              subject,
              html,
              studioId: member.studio_id,
              templateName: "payment_receipt",
            });
          }
          if (ownerForMemberPaid?.email) {
            const notice = memberPaymentSuccessOwnerNotice({
              ownerName: ownerForMemberPaid.full_name ?? "Studio Owner",
              memberName,
              memberEmail,
              amount: invoice.amount_paid,
              description: "Monthly membership",
              studioName,
            });
            await sendEmail({
              to: ownerForMemberPaid.email,
              subject: notice.subject,
              html: notice.html,
              studioId: member.studio_id,
              templateName: "member_payment_success_owner_notice",
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subscriptionId =
          typeof subRef === "string" ? subRef : subRef?.id ?? null;

        if (!subscriptionId) break;

        // パスサブスクリプションの支払い失敗チェック
        const { data: passSubFailed } = await adminSupabase
          .from("pass_subscriptions")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (passSubFailed) {
          await adminSupabase
            .from("pass_subscriptions")
            .update({ status: "past_due" })
            .eq("id", passSubFailed.id);

          // Send email notifications for pass subscription failure
          const { data: passSubDetail } = await adminSupabase
            .from("pass_subscriptions")
            .select("member_id, studio_id, studio_passes(name)")
            .eq("id", passSubFailed.id)
            .single();
          if (passSubDetail) {
            const [{ data: passStudioData }, { data: passMemberProf }, { data: passOwner }] = await Promise.all([
              adminSupabase.from("studios").select("name").eq("id", passSubDetail.studio_id).single(),
              adminSupabase.from("members").select("profiles(full_name, email)").eq("id", passSubDetail.member_id).single(),
              adminSupabase.from("profiles").select("full_name, email").eq("studio_id", passSubDetail.studio_id).eq("role", "owner").limit(1).single(),
            ]);
            const passStudioName = passStudioData?.name ?? "Studio";
            const passName = (passSubDetail.studio_passes as { name?: string } | null)?.name ?? "Pass subscription";
            const pm = (passMemberProf as { profiles?: { full_name?: string; email?: string } })?.profiles;
            const pmf = Array.isArray(pm) ? pm[0] : pm;

            if (pmf?.email) {
              const email = paymentFailed({
                memberName: pmf.full_name ?? "Member",
                amount: invoice.amount_due,
                studioName: passStudioName,
              });
              await sendEmail({ to: pmf.email, subject: email.subject, html: email.html, studioId: passSubDetail.studio_id, templateName: "payment_failed" });
            }
            if (passOwner?.email) {
              const notice = memberPaymentFailedOwnerNotice({
                ownerName: passOwner.full_name ?? "Studio Owner",
                memberName: pmf?.full_name ?? "Member",
                memberEmail: pmf?.email ?? "",
                amount: invoice.amount_due,
                description: passName,
                studioName: passStudioName,
              });
              await sendEmail({ to: passOwner.email, subject: notice.subject, html: notice.html, studioId: passSubDetail.studio_id, templateName: "member_payment_failed_owner_notice" });
            }
          }
          break;
        }

        // ── インストラクターメンバーシップの支払い失敗 ──
        const { data: instrMemFailed } = await adminSupabase
          .from("instructor_memberships")
          .select("id, instructor_id, studio_id, instructor_membership_tiers(name)")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (instrMemFailed) {
          await adminSupabase.from("payments").insert({
            studio_id: instrMemFailed.studio_id,
            amount: invoice.amount_due,
            currency: invoice.currency ?? "usd",
            type: "monthly",
            status: "failed",
            stripe_invoice_id: invoice.id,
            payment_type: "instructor_membership",
          });

          const [{ data: instrFailedStudio }, { data: instrFailedProfile }, { data: instrFailedOwner }] = await Promise.all([
            adminSupabase.from("studios").select("name").eq("id", instrMemFailed.studio_id).single(),
            adminSupabase.from("instructors").select("profiles(full_name, email)").eq("id", instrMemFailed.instructor_id).single(),
            adminSupabase.from("profiles").select("full_name, email").eq("studio_id", instrMemFailed.studio_id).eq("role", "owner").limit(1).single(),
          ]);
          const instrFailedStudioName = instrFailedStudio?.name ?? "Studio";
          const instrFailedTierName = (instrMemFailed.instructor_membership_tiers as { name?: string } | null)?.name ?? "Instructor membership";
          const ifp = (instrFailedProfile as { profiles?: { full_name?: string; email?: string } })?.profiles;
          const ifpf = Array.isArray(ifp) ? ifp[0] : ifp;

          if (ifpf?.email) {
            const email = paymentFailed({ memberName: ifpf.full_name ?? "Instructor", amount: invoice.amount_due, studioName: instrFailedStudioName });
            await sendEmail({ to: ifpf.email, subject: email.subject, html: email.html, studioId: instrMemFailed.studio_id, templateName: "payment_failed" });
          }
          if (instrFailedOwner?.email) {
            const notice = memberPaymentFailedOwnerNotice({
              ownerName: instrFailedOwner.full_name ?? "Studio Owner",
              memberName: ifpf?.full_name ?? "Instructor",
              memberEmail: ifpf?.email ?? "",
              amount: invoice.amount_due,
              description: instrFailedTierName,
              studioName: instrFailedStudioName,
            });
            await sendEmail({ to: instrFailedOwner.email, subject: notice.subject, html: notice.html, studioId: instrMemFailed.studio_id, templateName: "member_payment_failed_owner_notice" });
          }
          break;
        }

        const { data: studio } = await adminSupabase
          .from("studios")
          .select("id, plan_status")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (studio) {
          const isPastDue = studio.plan_status === "past_due";
          if (!isPastDue) {
            const in14Days = new Date();
            in14Days.setDate(in14Days.getDate() + 14);
            await adminSupabase
              .from("studios")
              .update({
                plan_status: "past_due",
                grace_period_ends_at: in14Days.toISOString(),
              })
              .eq("id", studio.id);
          }

          await adminSupabase.from("payments").insert({
            studio_id: studio.id,
            member_id: null,
            amount: invoice.amount_due,
            currency: invoice.currency ?? "usd",
            type: "subscription",
            status: "failed",
            stripe_invoice_id: invoice.id,
            payment_type: "subscription",
          });

          const [{ data: ownerProfile }, { data: studioData }] = await Promise.all([
            adminSupabase.from("profiles").select("full_name, email").eq("studio_id", studio.id).eq("role", "owner").limit(1).single(),
            adminSupabase.from("studios").select("name").eq("id", studio.id).single(),
          ]);
          if (ownerProfile?.email) {
            const { subject, html } = paymentFailed({
              memberName: ownerProfile.full_name ?? "Studio Owner",
              amount: invoice.amount_due,
              studioName: studioData?.name ?? "Studio",
            });
            await sendEmail({
              to: ownerProfile.email,
              subject,
              html,
              studioId: studio.id,
              templateName: "payment_failed",
            });
          }
          break;
        }

        const { data: member } = await adminSupabase
          .from("members")
          .select("id, studio_id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (member) {
          await adminSupabase.from("payments").insert({
            studio_id: member.studio_id,
            member_id: member.id,
            amount: invoice.amount_due,
            currency: invoice.currency ?? "usd",
            type: "monthly",
            status: "failed",
            stripe_invoice_id: invoice.id,
            payment_type: "monthly",
          });

          const [{ data: prof }, { data: studioData }, { data: ownerForMemberFailed }] = await Promise.all([
            adminSupabase.from("members").select("profiles(full_name, email)").eq("id", member.id).single(),
            adminSupabase.from("studios").select("name").eq("id", member.studio_id).single(),
            adminSupabase.from("profiles").select("full_name, email").eq("studio_id", member.studio_id).eq("role", "owner").limit(1).single(),
          ]);
          const p = (prof as { profiles?: { full_name?: string; email?: string } })?.profiles;
          const pf = Array.isArray(p) ? p[0] : p;
          const failedMemberName = pf?.full_name ?? "Member";
          const failedMemberEmail = pf?.email ?? "";
          const failedStudioName = studioData?.name ?? "Studio";

          if (failedMemberEmail) {
            const { subject, html } = paymentFailed({
              memberName: failedMemberName,
              amount: invoice.amount_due,
              studioName: failedStudioName,
            });
            await sendEmail({
              to: failedMemberEmail,
              subject,
              html,
              studioId: member.studio_id,
              templateName: "payment_failed",
            });
          }
          if (ownerForMemberFailed?.email) {
            const notice = memberPaymentFailedOwnerNotice({
              ownerName: ownerForMemberFailed.full_name ?? "Studio Owner",
              memberName: failedMemberName,
              memberEmail: failedMemberEmail,
              amount: invoice.amount_due,
              description: "Monthly membership",
              studioName: failedStudioName,
            });
            await sendEmail({
              to: ownerForMemberFailed.email,
              subject: notice.subject,
              html: notice.html,
              studioId: member.studio_id,
              templateName: "member_payment_failed_owner_notice",
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        // パスサブスクリプションの削除チェック
        const { data: passSubDeleted } = await adminSupabase
          .from("pass_subscriptions")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (passSubDeleted) {
          await adminSupabase
            .from("pass_subscriptions")
            .update({ status: "cancelled" })
            .eq("id", passSubDeleted.id);
          break;
        }

        // インストラクターメンバーシップのサブスク削除チェック
        const { data: deletedInstrMembership } = await adminSupabase
          .from("instructor_memberships")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (deletedInstrMembership) {
          await adminSupabase
            .from("instructor_memberships")
            .update({
              status: "cancelled",
              stripe_subscription_id: null,
              cancel_at_period_end: false,
            })
            .eq("id", deletedInstrMembership.id);
          break;
        }

        const { data: studio } = await adminSupabase
          .from("studios")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (studio) {
          await adminSupabase
            .from("studios")
            .update({
              plan_status: "canceled",
              stripe_subscription_id: null,
              cancel_at_period_end: false,
              grace_period_ends_at: null,
            })
            .eq("id", studio.id);
          break;
        }

        const { data: member } = await adminSupabase
          .from("members")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (member) {
          await adminSupabase
            .from("members")
            .update({
              plan_type: "drop_in",
              credits: 0,
              stripe_subscription_id: null,
            })
            .eq("id", member.id);
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const accountId = account.id;
        const chargesEnabled = account.charges_enabled ?? false;
        const payoutsEnabled = account.payouts_enabled ?? false;
        const onboardingComplete = chargesEnabled && payoutsEnabled;

        const [{ data: inst }, { data: studioAcct }] = await Promise.all([
          adminSupabase.from("instructors").select("id, stripe_onboarding_complete").eq("stripe_account_id", accountId).maybeSingle(),
          adminSupabase.from("studios").select("id, stripe_connect_onboarding_complete").eq("stripe_connect_account_id", accountId).maybeSingle(),
        ]);

        if (inst) {
          if (onboardingComplete !== inst.stripe_onboarding_complete) {
            await adminSupabase.from("instructors").update({ stripe_onboarding_complete: onboardingComplete }).eq("id", inst.id);
          }
        } else if (studioAcct) {
          if (onboardingComplete !== studioAcct.stripe_connect_onboarding_complete) {
            await adminSupabase.from("studios").update({ stripe_connect_onboarding_complete: onboardingComplete }).eq("id", studioAcct.id);
          }
        }
        break;
      }

      default:
        break;
    }

    const studioIdForLog = await getStudioIdFromStripeEvent(event, adminSupabase);
    await insertWebhookLog(adminSupabase, {
      event_type: event.type,
      event_id: event.id,
      studio_id: studioIdForLog,
      status: "success",
      payload: { type: event.type, id: event.id },
    });

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message = err instanceof Error
      ? `${err.message}\n${err.stack ?? ""}`
      : "Internal error";
    if (adminSupabase) {
      try {
        await insertWebhookLog(adminSupabase, {
          event_type: "webhook_error",
          event_id: eventId,
          studio_id: null,
          status: "failure",
          error_message: message,
        });
      } catch {
        // Logging failure should not prevent response
      }
    }
    // Return 500 so Stripe retries the webhook delivery.
    return NextResponse.json({ error: message, received: false }, { status: 500 });
  }
}

/**
 * パスサブスクリプションの checkout.session.completed を処理。
 * Checkout Sessionからpass_subscriptionsを作成。
 * monthly → subscription mode、class_pack/drop_in → payment mode を両方対応。
 */
async function handlePassSubscriptionCheckout(
  session: Stripe.Checkout.Session,
  adminSupabase: SupabaseClient
) {
  const memberId = session.metadata?.member_id;
  const studioPassId = session.metadata?.studio_pass_id;
  const subscriptionId = getSubscriptionId(session.subscription as string | Stripe.Subscription | null);
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

  // Need at least one Stripe identifier for idempotency
  const stripeId = subscriptionId || paymentIntentId;
  if (!memberId || !studioPassId || !stripeId) return;

  const [{ data: existing }, { data: activeDup }] = await Promise.all([
    adminSupabase.from("pass_subscriptions").select("id").eq("stripe_subscription_id", stripeId).maybeSingle(),
    adminSupabase.from("pass_subscriptions").select("id").eq("member_id", memberId).eq("studio_pass_id", studioPassId).eq("status", "active").maybeSingle(),
  ]);
  if (existing || activeDup) return;

  const connectedAccountId = (session as Stripe.Checkout.Session & { account?: string }).account;
  const expiresOn = session.metadata?.expires_on;
  let periodStartDate: string | null = null;
  let periodEndDate: string | null = null;

  if (subscriptionId && connectedAccountId) {
    // Subscription mode — get period dates from Stripe subscription
    try {
      const sub = await stripe.subscriptions.retrieve(
        subscriptionId,
        { stripeAccount: connectedAccountId }
      );
      const periodStart = sub.items.data[0]?.current_period_start;
      const periodEnd = sub.items.data[0]?.current_period_end;
      if (periodStart) periodStartDate = new Date(periodStart * 1000).toISOString().slice(0, 10);
      if (periodEnd) periodEndDate = new Date(periodEnd * 1000).toISOString().slice(0, 10);
    } catch {
      // Fall through — dates will be null
    }
  } else {
    // One-time payment (class_pack / drop_in) — period starts today
    periodStartDate = new Date().toISOString().slice(0, 10);
    // For one-time passes, look up expires_after_days from the pass record
    if (!expiresOn) {
      const { data: passRecord } = await adminSupabase
        .from("studio_passes")
        .select("expires_after_days")
        .eq("id", studioPassId)
        .single();
      if (passRecord?.expires_after_days) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + passRecord.expires_after_days);
        periodEndDate = endDate.toISOString().slice(0, 10);
      }
    }
  }

  // Fixed expiration date from metadata always takes precedence
  if (expiresOn) {
    periodEndDate = expiresOn;
  }

  await adminSupabase.from("pass_subscriptions").insert({
    studio_pass_id: studioPassId,
    member_id: memberId,
    stripe_subscription_id: stripeId,
    status: "active",
    current_period_start: periodStartDate,
    current_period_end: periodEndDate,
  });
}

/**
 * インストラクターメンバーシップの checkout.session.completed を処理。
 * サブスクリプションIDを instructor_memberships に保存。
 */
async function handleInstructorMembershipCheckout(
  session: Stripe.Checkout.Session,
  adminSupabase: SupabaseClient
) {
  const membershipId = session.metadata?.membership_id;
  if (!membershipId) return;

  const subscriptionId = getSubscriptionId(
    session.subscription as string | Stripe.Subscription | null
  );

  const periodEnd = session.subscription
    ? (() => {
        // subscription は expand されていないので retrieve が必要
        // ただし checkout.session では通常IDのみなのでここでは null
        return null;
      })()
    : null;

  await adminSupabase
    .from("instructor_memberships")
    .update({
      stripe_subscription_id: subscriptionId,
      status: "active",
    })
    .eq("id", membershipId);
}

async function handleInstructorDirectPayout(
  session: Stripe.Checkout.Session,
  connectedAccountId: string,
  adminSupabase: SupabaseClient
) {
  const studioId = session.metadata?.studio_id;
  const memberId = session.metadata?.member_id;
  const sessionId = session.metadata?.session_id;
  const instructorId = session.metadata?.instructor_id;
  const studioFee = parseInt(session.metadata?.studio_fee ?? "0", 10);
  const platformFee = parseInt(session.metadata?.platform_fee ?? "0", 10);
  const feeType = session.metadata?.fee_type ?? "percentage";
  const feeSource = session.metadata?.fee_source ?? "studio_default";

  if (!studioId || !memberId || !sessionId || !instructorId) return;

  const amount = session.amount_total ?? 0;
  const paymentIntentId = session.payment_intent as string | null;

  // Estimate Stripe fee (2.9% + $0.30 for standard US cards)
  const stripeFeeEstimate = Math.round(amount * 0.029 + 30);
  const instructorPayout = Math.max(0, amount - studioFee - platformFee - stripeFeeEstimate);

  // 1. Create booking for the session
  const { data: existingBooking } = await adminSupabase
    .from("bookings")
    .select("id")
    .eq("session_id", sessionId)
    .eq("member_id", memberId)
    .maybeSingle();

  let bookingId: string | null = existingBooking?.id ?? null;

  if (!existingBooking) {
    const { data: newBooking } = await adminSupabase
      .from("bookings")
      .insert({
        studio_id: studioId,
        session_id: sessionId,
        member_id: memberId,
        status: "confirmed",
        attended: false,
      })
      .select("id")
      .single();
    bookingId = newBooking?.id ?? null;
  }

  // 2. Insert instructor_earnings record
  const { data: earningRecord } = await adminSupabase
    .from("instructor_earnings")
    .insert({
      studio_id: studioId,
      instructor_id: instructorId,
      session_id: sessionId,
      booking_id: bookingId,
      gross_amount: amount,
      stripe_fee: stripeFeeEstimate,
      platform_fee: platformFee,
      studio_fee: studioFee,
      instructor_payout: instructorPayout,
      studio_fee_percentage: parseFloat(
        session.metadata?.studio_fee_percentage ?? "0"
      ),
      fee_type: feeType,
      fee_source: feeSource,
      stripe_payment_intent_id: paymentIntentId,
      status: "pending",
    })
    .select("id")
    .single();

  // 3. Transfer studio fee to studio's Connected Account
  if (studioFee > 0) {
    const { data: studio } = await adminSupabase
      .from("studios")
      .select("stripe_connect_account_id")
      .eq("id", studioId)
      .single();

    if (studio?.stripe_connect_account_id) {
      try {
        const transfer = await stripe.transfers.create({
          amount: studioFee,
          currency: session.currency ?? "usd",
          destination: studio.stripe_connect_account_id,
          metadata: {
            studio_id: studioId,
            instructor_id: instructorId,
            session_id: sessionId,
            type: "studio_fee",
          },
        });

        // 4. Update earnings record with transfer id and status
        if (earningRecord) {
          await adminSupabase
            .from("instructor_earnings")
            .update({
              stripe_transfer_id: transfer.id,
              status: "completed",
            })
            .eq("id", earningRecord.id);
        }
      } catch (transferErr) {
        // Log error but don't fail the webhook
        console.error("Studio fee transfer failed:", transferErr);
        if (earningRecord) {
          await adminSupabase
            .from("instructor_earnings")
            .update({ status: "failed" })
            .eq("id", earningRecord.id);
        }
      }
    }
  } else if (earningRecord) {
    // No studio fee to transfer, mark as completed
    await adminSupabase
      .from("instructor_earnings")
      .update({ status: "completed" })
      .eq("id", earningRecord.id);
  }

  // 5. Create payment record
  await adminSupabase.from("payments").insert({
    studio_id: studioId,
    member_id: memberId,
    amount,
    currency: session.currency ?? "usd",
    type: "drop_in",
    status: "paid",
    stripe_payment_intent_id: paymentIntentId,
    payment_type: "drop_in",
    description: `Instructor direct payout`,
    paid_at: new Date().toISOString(),
  });

  // 5b. Record discount redemption + bump used_count. The class-checkout
  // route stamped these onto session.metadata when the code resolved
  // (typed-in or auto-applied by member tag).
  const discountCodeId = session.metadata?.discount_code_id;
  const discountAmountOff = parseInt(
    session.metadata?.discount_amount_off ?? "0",
    10
  );
  if (discountCodeId && discountAmountOff > 0) {
    try {
      await recordDiscountRedemption(adminSupabase, {
        studioId,
        discountCodeId,
        memberId,
        amountOffCents: discountAmountOff,
        context: "class_booking",
        contextId: bookingId ?? null,
      });
    } catch (err) {
      console.error("Failed to record discount redemption:", err);
    }
  }

  // 6. Send email notification to instructor
  try {
    const [{ data: instructorData }, { data: classSession }, { data: studioData }] = await Promise.all([
      adminSupabase.from("instructors").select("profile_id, profiles(full_name, email)").eq("id", instructorId).single(),
      adminSupabase.from("class_sessions").select("session_date, start_time, title, classes(name)").eq("id", sessionId).single(),
      adminSupabase.from("studios").select("name").eq("id", studioId).single(),
    ]);

    if (instructorData) {
      const rawProf = Array.isArray(instructorData.profiles) ? (instructorData.profiles as { full_name?: string; email?: string }[])[0] : instructorData.profiles as { full_name?: string; email?: string } | null;
      const instProfile = rawProf ?? null;

      if (instProfile?.email) {
        const cls = classSession as { session_date?: string; start_time?: string; title?: string; classes?: { name?: string } | null } | null;
        const className = cls?.title ?? cls?.classes?.name ?? "Class";
        const sessionDate = cls?.session_date ?? "";
        const studioName = studioData?.name ?? "Studio";

        const { subject, html } = instructorPaymentNotification({
          instructorName: instProfile.full_name ?? "Instructor",
          className,
          sessionDate,
          grossAmount: amount,
          studioFee,
          platformFee,
          stripeFee: stripeFeeEstimate,
          instructorPayout,
          studioName,
        });

        await sendEmail({
          to: instProfile.email,
          subject,
          html,
          studioId,
          templateName: "instructor_payment_notification",
        });
      }
    }
  } catch (emailErr) {
    // Don't fail the webhook if email fails
    console.error("Instructor payment notification email failed:", emailErr);
  }
}

async function getStudioIdFromStripeEvent(
  event: Stripe.Event,
  supabase: SupabaseClient
): Promise<string | null> {
  try {
    const connectedAccountId = (event as Stripe.Event & { account?: string })
      .account;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      // Check metadata first (covers instructor_direct case)
      if (session.metadata?.studio_id) {
        return session.metadata.studio_id;
      }
      if (connectedAccountId) {
        const { data: studio } = await supabase
          .from("studios")
          .select("id")
          .eq("stripe_connect_account_id", connectedAccountId)
          .single();
        if (studio) return studio.id;
        // Check if it's an instructor account
        const { data: inst } = await supabase
          .from("instructors")
          .select("studio_id")
          .eq("stripe_account_id", connectedAccountId)
          .maybeSingle();
        return inst?.studio_id ?? null;
      }
      return null;
    }
    if (event.type === "account.updated") {
      if (connectedAccountId) {
        const { data: studio } = await supabase
          .from("studios")
          .select("id")
          .eq("stripe_connect_account_id", connectedAccountId)
          .maybeSingle();
        if (studio) return studio.id;
        const { data: inst } = await supabase
          .from("instructors")
          .select("studio_id")
          .eq("stripe_account_id", connectedAccountId)
          .maybeSingle();
        return inst?.studio_id ?? null;
      }
      return null;
    }
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const { data: studio } = await supabase
        .from("studios")
        .select("id")
        .eq("stripe_subscription_id", sub.id)
        .single();
      return studio?.id ?? null;
    }
    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subRef = invoice.parent?.subscription_details?.subscription;
      const subId = typeof subRef === "string" ? subRef : (subRef as { id?: string } | null | undefined)?.id ?? null;
      if (!subId) return null;
      const { data: studio } = await supabase
        .from("studios")
        .select("id")
        .eq("stripe_subscription_id", subId)
        .single();
      if (studio) return studio.id;
      const { data: member } = await supabase
        .from("members")
        .select("studio_id")
        .eq("stripe_subscription_id", subId)
        .single();
      return member?.studio_id ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * イベント予約の checkout.session.completed を処理。
 * - booking_status を confirmed に更新
 * - 分割払いの場合: 1回目のscheduleをpaidに、PaymentMethodを全scheduleに保存
 * - 一括払いの場合: scheduleをpaidに、payment_statusをfully_paidに
 * - 確認メール送信
 */
async function handleEventBookingCheckout(
  session: Stripe.Checkout.Session,
  supabase: SupabaseClient
) {
  const bookingId = session.metadata?.event_booking_id;
  const paymentType = session.metadata?.payment_type; // 'full' | 'installment'
  const studioId = session.metadata?.studio_id;
  const eventId = session.metadata?.event_id;

  if (!bookingId) {
    console.error("[EventWebhook] Missing event_booking_id in metadata");
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // Get payment method from PaymentIntent for future off-session charges
  let paymentMethodId: string | null = null;
  if (paymentIntentId) {
    try {
      const stripeClient = stripe;
      let connAcct: string | undefined;
      if (studioId) {
        const { data: studioData } = await supabase
          .from("studios")
          .select("stripe_connect_account_id")
          .eq("id", studioId)
          .single();
        connAcct = studioData?.stripe_connect_account_id ?? undefined;
      }

      const pi = await stripeClient.paymentIntents.retrieve(paymentIntentId, {}, connAcct ? { stripeAccount: connAcct } : undefined);
      paymentMethodId =
        typeof pi.payment_method === "string"
          ? pi.payment_method
          : pi.payment_method?.id ?? null;
    } catch (e) {
      console.error("[EventWebhook] Failed to retrieve payment method:", e);
    }
  }

  if (paymentType === "installment") {
    const now = new Date().toISOString();
    const installmentUpdates: PromiseLike<unknown>[] = [
      supabase.from("event_payment_schedule").update({
        status: "paid", paid_at: now, stripe_payment_intent_id: paymentIntentId,
      }).eq("event_booking_id", bookingId).eq("installment_number", 1),
      supabase.from("event_bookings").update({
        booking_status: "confirmed", payment_status: "partial", updated_at: now,
      }).eq("id", bookingId),
    ];
    if (paymentMethodId) {
      installmentUpdates.push(
        supabase.from("event_payment_schedule").update({ stripe_payment_method_id: paymentMethodId }).eq("event_booking_id", bookingId)
      );
    }
    await Promise.all(installmentUpdates);
  } else {
    const now = new Date().toISOString();
    await Promise.all([
      supabase.from("event_payment_schedule").update({
        status: "paid", paid_at: now, stripe_payment_intent_id: paymentIntentId,
      }).eq("event_booking_id", bookingId).eq("installment_number", 1),
      supabase.from("event_bookings").update({
        booking_status: "confirmed", payment_status: "fully_paid", updated_at: now,
      }).eq("id", bookingId),
    ]);
  }

  // Record discount redemption + bump used_count. metadata is stamped by
  // /api/events/checkout when a code resolves (typed-in or auto-applied
  // via member tag). Best effort — failures don't break the booking.
  const eventDiscountCodeId = session.metadata?.discount_code_id;
  const eventDiscountAmountOff = parseInt(
    session.metadata?.discount_amount_off ?? "0",
    10
  );
  if (eventDiscountCodeId && eventDiscountAmountOff > 0 && studioId) {
    try {
      const { data: bk } = await supabase
        .from("event_bookings")
        .select("member_id")
        .eq("id", bookingId)
        .single();
      await recordDiscountRedemption(supabase, {
        studioId,
        discountCodeId: eventDiscountCodeId,
        memberId: bk?.member_id ?? null,
        amountOffCents: eventDiscountAmountOff,
        context: "event_booking",
        contextId: bookingId,
      });
    } catch (err) {
      console.error("Failed to record event discount redemption:", err);
    }
  }

  // Send confirmation email + owner notification
  try {
    const [{ data: bookingData }, eventResult, studioResult] = await Promise.all([
      supabase.from("event_bookings").select("guest_name, guest_email, total_amount_cents, payment_type, event_option_id").eq("id", bookingId).single(),
      eventId
        ? supabase.from("events").select("name, start_date, end_date, location_name, installment_count, studio_id, cancellation_policy_text, confirmation_subject_override, confirmation_body_override").eq("id", eventId).single()
        : Promise.resolve({ data: null }),
      studioId
        ? supabase.from("studios").select("name, event_confirmation_subject, event_confirmation_body").eq("id", studioId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const eventData = eventResult?.data ?? null;
    const studioRow = studioResult?.data ?? null;

    let eventOverrideSubject: string | null =
      (eventData as { confirmation_subject_override?: string | null } | null)
        ?.confirmation_subject_override || null;
    let eventOverrideBody: string | null =
      (eventData as { confirmation_body_override?: string | null } | null)
        ?.confirmation_body_override || null;
    const resolvedStudioName = (studioRow as { name?: string } | null)?.name;
    if (!eventOverrideSubject) {
      eventOverrideSubject =
        (studioRow as { event_confirmation_subject?: string | null } | null)
          ?.event_confirmation_subject || null;
    }
    if (!eventOverrideBody) {
      eventOverrideBody =
        (studioRow as { event_confirmation_body?: string | null } | null)
          ?.event_confirmation_body || null;
    }

    if (bookingData?.guest_email && eventData) {
      // Get option name
      let optionName = "—";
      if (bookingData.event_option_id) {
        const { data: opt } = await supabase
          .from("event_options")
          .select("name")
          .eq("id", bookingData.event_option_id)
          .single();
        optionName = opt?.name ?? "—";
      }

      const policySummary = eventData.cancellation_policy_text || "";

      if (paymentType === "installment") {
        const [{ data: nextSchedule }, { count: remainingCount }, { data: firstSchedule }] = await Promise.all([
          supabase.from("event_payment_schedule").select("amount_cents, due_date").eq("event_booking_id", bookingId).eq("status", "pending").order("installment_number").limit(1).single(),
          supabase.from("event_payment_schedule").select("id", { count: "exact", head: true }).eq("event_booking_id", bookingId).eq("status", "pending"),
          supabase.from("event_payment_schedule").select("amount_cents").eq("event_booking_id", bookingId).eq("installment_number", 1).single(),
        ]);

        const email = eventBookingConfirmedInstallment({
          guestName: bookingData.guest_name || "Guest",
          eventName: eventData.name,
          startDate: eventData.start_date,
          endDate: eventData.end_date,
          locationName: eventData.location_name,
          optionName,
          totalAmountCents: bookingData.total_amount_cents,
          paidAmountCents: firstSchedule?.amount_cents ?? 0,
          nextPaymentDate: nextSchedule?.due_date ?? "TBD",
          nextPaymentAmountCents: nextSchedule?.amount_cents ?? 0,
          remainingInstallments: remainingCount ?? 0,
          cancellationPolicySummary: policySummary,
        });

        await sendEmail({
          to: bookingData.guest_email,
          subject: email.subject,
          html: email.html,
          studioId: studioId ?? null,
          templateName: "event_booking_confirmed_installment",
        });
      } else {
        const email = eventBookingConfirmedFull({
          guestName: bookingData.guest_name || "Guest",
          eventName: eventData.name,
          startDate: eventData.start_date,
          endDate: eventData.end_date,
          locationName: eventData.location_name,
          optionName,
          amountCents: bookingData.total_amount_cents,
          cancellationPolicySummary: policySummary,
          overrideSubject: eventOverrideSubject,
          overrideBody: eventOverrideBody,
          studioName: resolvedStudioName,
        });

        await sendEmail({
          to: bookingData.guest_email,
          subject: email.subject,
          html: email.html,
          studioId: studioId ?? null,
          templateName: "event_booking_confirmed_full",
        });
      }

      // Owner notification
      const targetStudioId = eventData.studio_id || studioId;
      if (targetStudioId) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("studio_id", targetStudioId)
          .eq("role", "owner")
          .limit(1)
          .single();

        if (ownerProfile?.email) {
          const ownerEmail = ownerNewBookingNotification({
            ownerName: ownerProfile.full_name || "Studio Owner",
            guestName: bookingData.guest_name || "Guest",
            eventName: eventData.name,
            optionName,
            amountCents: bookingData.total_amount_cents,
            paymentType: bookingData.payment_type,
          });

          await sendEmail({
            to: ownerProfile.email,
            subject: ownerEmail.subject,
            html: ownerEmail.html,
            studioId: targetStudioId,
            templateName: "owner_new_event_booking",
          });
        }
      }
    }
  } catch (e) {
    console.error("[EventWebhook] Failed to send confirmation email:", e);
  }
}
