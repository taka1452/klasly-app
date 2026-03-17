// @ts-nocheck - Supabase generated types do not match DB schema (payments, members, studios)
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe/server";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { paymentReceipt, paymentFailed, instructorPaymentNotification, eventBookingConfirmation, eventBookingConfirmedFull, eventBookingConfirmedInstallment, ownerNewBookingNotification } from "@/lib/email/templates";
import { insertWebhookLog } from "@/lib/admin/logs";

/** session.subscription は string | Subscription (expand時) のため、必ずID文字列を返す */
function getSubscriptionId(sub: string | Stripe.Subscription | null): string | null {
  return sub == null ? null : typeof sub === "string" ? sub : sub.id;
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  let adminSupabase: ReturnType<typeof createClient> | null = null;

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
            const next = Math.max(0, current) + credits;
            await adminSupabase
              .from("members")
              .update({ credits: next })
              .eq("id", memberId);
          }

          const { data: memberProfile } = await adminSupabase
            .from("members")
            .select("profiles(full_name, email)")
            .eq("id", memberId)
            .single();
          const { data: studioData } = await adminSupabase
            .from("studios")
            .select("name")
            .eq("id", studioId)
            .single();
          const { data: productRow } = await adminSupabase
            .from("products")
            .select("name")
            .eq("id", productId)
            .single();
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

          const { data: ownerProfile } = await adminSupabase
            .from("profiles")
            .select("full_name, email")
            .eq("studio_id", studio.id)
            .eq("role", "owner")
            .limit(1)
            .single();
          const { data: studioData } = await adminSupabase
            .from("studios")
            .select("name")
            .eq("id", studio.id)
            .single();
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

          const { data: prof } = await adminSupabase
            .from("members")
            .select("profiles(full_name, email)")
            .eq("id", member.id)
            .single();
          const { data: studioData } = await adminSupabase
            .from("studios")
            .select("name")
            .eq("id", member.studio_id)
            .single();
          const p = (prof as { profiles?: { full_name?: string; email?: string } })?.profiles;
          const pf = Array.isArray(p) ? p[0] : p;
          if (pf?.email) {
            const { subject, html } = paymentReceipt({
              memberName: pf.full_name ?? "Member",
              amount: invoice.amount_paid,
              description: "Monthly membership",
              studioName: studioData?.name ?? "Studio",
            });
            await sendEmail({
              to: pf.email,
              subject,
              html,
              studioId: member.studio_id,
              templateName: "payment_receipt",
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

          const { data: ownerProfile } = await adminSupabase
            .from("profiles")
            .select("full_name, email")
            .eq("studio_id", studio.id)
            .eq("role", "owner")
            .limit(1)
            .single();
          const { data: studioData } = await adminSupabase
            .from("studios")
            .select("name")
            .eq("id", studio.id)
            .single();
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

          const { data: prof } = await adminSupabase
            .from("members")
            .select("profiles(full_name, email)")
            .eq("id", member.id)
            .single();
          const { data: studioData } = await adminSupabase
            .from("studios")
            .select("name")
            .eq("id", member.studio_id)
            .single();
          const p = (prof as { profiles?: { full_name?: string; email?: string } })?.profiles;
          const pf = Array.isArray(p) ? p[0] : p;
          if (pf?.email) {
            const { subject, html } = paymentFailed({
              memberName: pf.full_name ?? "Member",
              amount: invoice.amount_due,
              studioName: studioData?.name ?? "Studio",
            });
            await sendEmail({
              to: pf.email,
              subject,
              html,
              studioId: member.studio_id,
              templateName: "payment_failed",
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

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

        // Check if this is an instructor account
        const { data: inst } = await adminSupabase
          .from("instructors")
          .select("id, stripe_onboarding_complete")
          .eq("stripe_account_id", accountId)
          .maybeSingle();

        if (inst) {
          if (onboardingComplete !== inst.stripe_onboarding_complete) {
            await adminSupabase
              .from("instructors")
              .update({ stripe_onboarding_complete: onboardingComplete })
              .eq("id", inst.id);
          }
          break;
        }

        // Check if this is a studio account
        const { data: studioAcct } = await adminSupabase
          .from("studios")
          .select("id, stripe_connect_onboarding_complete")
          .eq("stripe_connect_account_id", accountId)
          .maybeSingle();

        if (studioAcct) {
          if (onboardingComplete !== studioAcct.stripe_connect_onboarding_complete) {
            await adminSupabase
              .from("studios")
              .update({ stripe_connect_onboarding_complete: onboardingComplete })
              .eq("id", studioAcct.id);
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
    const message = err instanceof Error ? err.message : "Internal error";
    if (adminSupabase) {
      await insertWebhookLog(adminSupabase, {
        event_type: "webhook_error",
        event_id: null,
        studio_id: null,
        status: "failure",
        error_message: message,
      });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * インストラクターメンバーシップの checkout.session.completed を処理。
 * サブスクリプションIDを instructor_memberships に保存。
 */
async function handleInstructorMembershipCheckout(
  session: Stripe.Checkout.Session,
  adminSupabase: ReturnType<typeof createClient>
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
  adminSupabase: ReturnType<typeof createClient>
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
  const instructorPayout = amount - studioFee - platformFee - stripeFeeEstimate;

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

  // 6. Send email notification to instructor
  try {
    const { data: instructorData } = await adminSupabase
      .from("instructors")
      .select("profile_id")
      .eq("id", instructorId)
      .single();

    if (instructorData) {
      const { data: instProfile } = await adminSupabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", instructorData.profile_id)
        .single();

      const { data: classSession } = await adminSupabase
        .from("class_sessions")
        .select("session_date, start_time, classes(name)")
        .eq("id", sessionId)
        .single();

      const { data: studioData } = await adminSupabase
        .from("studios")
        .select("name")
        .eq("id", studioId)
        .single();

      if (instProfile?.email) {
        const cls = classSession as { session_date?: string; start_time?: string; classes?: { name?: string } | null } | null;
        const className = cls?.classes?.name ?? "Class";
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
  supabase: ReturnType<typeof createClient>
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
  supabase: ReturnType<typeof createClient>
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
      // Retrieve PI from connected account
      const { data: booking } = await supabase
        .from("event_bookings")
        .select("event_id")
        .eq("id", bookingId)
        .single();

      const { data: eventData } = booking
        ? await supabase
            .from("events")
            .select("studio_id")
            .eq("id", booking.event_id)
            .single()
        : { data: null };

      let connAcct: string | undefined;
      if (eventData?.studio_id) {
        const { data: studioData } = await supabase
          .from("studios")
          .select("stripe_connect_account_id")
          .eq("id", eventData.studio_id)
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
    // Update first installment as paid
    await supabase
      .from("event_payment_schedule")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("event_booking_id", bookingId)
      .eq("installment_number", 1);

    // Save payment method to ALL schedule records for future off-session charges
    if (paymentMethodId) {
      await supabase
        .from("event_payment_schedule")
        .update({ stripe_payment_method_id: paymentMethodId })
        .eq("event_booking_id", bookingId);
    }

    // Update booking: confirmed + partial
    await supabase
      .from("event_bookings")
      .update({
        booking_status: "confirmed",
        payment_status: "partial",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);
  } else {
    // Full payment
    await supabase
      .from("event_payment_schedule")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("event_booking_id", bookingId)
      .eq("installment_number", 1);

    await supabase
      .from("event_bookings")
      .update({
        booking_status: "confirmed",
        payment_status: "fully_paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);
  }

  // Send confirmation email + owner notification
  try {
    const { data: bookingData } = await supabase
      .from("event_bookings")
      .select("guest_name, guest_email, total_amount_cents, payment_type, event_option_id")
      .eq("id", bookingId)
      .single();

    const { data: eventData } = eventId
      ? await supabase
          .from("events")
          .select("name, start_date, end_date, location_name, installment_count, studio_id, cancellation_policy_text")
          .eq("id", eventId)
          .single()
      : { data: null };

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
        // Get next pending schedule
        const { data: nextSchedule } = await supabase
          .from("event_payment_schedule")
          .select("amount_cents, due_date")
          .eq("event_booking_id", bookingId)
          .eq("status", "pending")
          .order("installment_number")
          .limit(1)
          .single();

        const { count: remainingCount } = await supabase
          .from("event_payment_schedule")
          .select("id", { count: "exact", head: true })
          .eq("event_booking_id", bookingId)
          .eq("status", "pending");

        // Get first installment amount (what was just paid)
        const { data: firstSchedule } = await supabase
          .from("event_payment_schedule")
          .select("amount_cents")
          .eq("event_booking_id", bookingId)
          .eq("installment_number", 1)
          .single();

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
