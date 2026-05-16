import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { logger } from "@/lib/logger";
export async function POST(request: Request) {
  try {
    // CSRF protection is handled by middleware
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    // --- Member self-delete branch (GDPR) ---
    // Members can permanently delete their own account and data. This only
    // touches their own member/booking/payment/etc. rows — not the studio
    // or other members. Runs before the owner check so members aren't
    // blocked by the "Only studio owners" error.
    if (profile?.role === "member") {
      const { data: memberRecord } = await adminSupabase
        .from("members")
        .select("id, stripe_subscription_id")
        .eq("profile_id", user.id)
        .maybeSingle();

      const failedMemberCancellations: string[] = [];

      if (memberRecord) {
        const stripe = getStripe();

        const safeCancel = async (subId: string, context: string) => {
          try {
            await stripe.subscriptions.cancel(subId);
          } catch (err) {
            const code = (err as { code?: string })?.code;
            if (code !== "resource_missing") {
              failedMemberCancellations.push(subId);
              logger.error(
                `account/delete: Stripe cancel failed (${context})`,
                {
                  memberId: memberRecord.id,
                  subscriptionId: subId,
                  error: err instanceof Error ? err.message : String(err),
                }
              );
            }
          }
        };

        // Cancel any member-level subscription
        if (memberRecord.stripe_subscription_id) {
          await safeCancel(memberRecord.stripe_subscription_id, "member-self");
        }

        // Cancel any active pass subscriptions
        const { data: passSubs } = await adminSupabase
          .from("pass_subscriptions")
          .select("stripe_subscription_id")
          .eq("member_id", memberRecord.id)
          .not("stripe_subscription_id", "is", null);
        for (const ps of passSubs || []) {
          if (ps.stripe_subscription_id) {
            await safeCancel(ps.stripe_subscription_id, "pass-self");
          }
        }

        // Delete the member's own data. Most child rows cascade via FK, but
        // we delete explicitly to be safe across environments.
        await adminSupabase
          .from("pass_subscriptions")
          .delete()
          .eq("member_id", memberRecord.id);
        await adminSupabase
          .from("bookings")
          .delete()
          .eq("member_id", memberRecord.id);
        await adminSupabase
          .from("class_reviews")
          .delete()
          .eq("member_id", memberRecord.id);
        await adminSupabase
          .from("waiver_signatures")
          .delete()
          .eq("member_id", memberRecord.id);
        await adminSupabase
          .from("payments")
          .delete()
          .eq("member_id", memberRecord.id);
        await adminSupabase
          .from("members")
          .delete()
          .eq("id", memberRecord.id);
      }

      // Remove profile + auth user
      await adminSupabase.from("profiles").delete().eq("id", user.id);
      await adminSupabase.auth.admin.deleteUser(user.id);

      await serverSupabase.auth.signOut();

      return NextResponse.json({
        success: true,
        ...(failedMemberCancellations.length > 0 && {
          warning: `${failedMemberCancellations.length} Stripe subscription(s) could not be cancelled automatically. Please check Stripe dashboard.`,
        }),
      });
    }

    if (profile?.role !== "owner" || !profile?.studio_id) {
      return NextResponse.json(
        { error: "Only studio owners can delete their account" },
        { status: 403 }
      );
    }

    const studioId = profile.studio_id;

    // Cancel all active Stripe subscriptions before deleting data
    // 失敗しても DB 削除は続行（ユーザーの意思によるアカウント削除を妨げない）
    // ただし失敗した subscription ID をログに記録して追跡可能にする
    const stripe = getStripe();
    const failedCancellations: string[] = [];

    const safeCancelSub = async (subId: string, context: string) => {
      try {
        await stripe.subscriptions.cancel(subId);
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code !== "resource_missing") {
          failedCancellations.push(subId);
          logger.error(`account/delete: Stripe cancel failed (${context})`, {
            studioId,
            subscriptionId: subId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };

    // 1. Cancel studio plan subscription
    const { data: studio } = await adminSupabase
      .from("studios")
      .select("stripe_subscription_id")
      .eq("id", studioId)
      .single();
    if (studio?.stripe_subscription_id) {
      await safeCancelSub(studio.stripe_subscription_id, "studio-plan");
    }

    // 2. Cancel member subscriptions
    const { data: members } = await adminSupabase
      .from("members")
      .select("stripe_subscription_id")
      .eq("studio_id", studioId)
      .not("stripe_subscription_id", "is", null);
    for (const m of members || []) {
      if (m.stripe_subscription_id) {
        await safeCancelSub(m.stripe_subscription_id, "member");
      }
    }

    // 3. Cancel pass subscriptions
    const { data: memberIds } = await adminSupabase
      .from("members")
      .select("id")
      .eq("studio_id", studioId);
    if (memberIds && memberIds.length > 0) {
      const { data: passSubs } = await adminSupabase
        .from("pass_subscriptions")
        .select("stripe_subscription_id")
        .in("member_id", memberIds.map((m) => m.id))
        .not("stripe_subscription_id", "is", null);
      for (const ps of passSubs || []) {
        if (ps.stripe_subscription_id) {
          await safeCancelSub(ps.stripe_subscription_id, "pass");
        }
      }
    }

    // 4. Cancel instructor membership subscriptions
    const { data: instrMemberships } = await adminSupabase
      .from("instructor_memberships")
      .select("stripe_subscription_id")
      .eq("studio_id", studioId)
      .not("stripe_subscription_id", "is", null);
    for (const im of instrMemberships || []) {
      if (im.stripe_subscription_id) {
        await safeCancelSub(im.stripe_subscription_id, "instructor-membership");
      }
    }

    if (failedCancellations.length > 0) {
      logger.warn("account/delete: Some Stripe subscriptions failed to cancel", {
        studioId,
        failedSubscriptionIds: failedCancellations,
      });
    }

    // Get all user IDs (profiles) for this studio before deletion
    const { data: studioProfiles } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("studio_id", studioId);
    const userIdsToDelete = (studioProfiles || []).map((p) => p.id);

    // Delete in order (respecting FK constraints), parallelized where safe
    const del = (table: string, col = "studio_id") =>
      adminSupabase.from(table).delete().eq(col, studioId);

    // Layer 1: leaf tables (no dependents)
    const { data: memberIdsForDelete } = await adminSupabase
      .from("members")
      .select("id")
      .eq("studio_id", studioId);

    await Promise.all([
      del("event_bookings"),
      del("drop_in_attendances"),
      del("payments"),
      del("instructor_earnings"),
      del("instructor_overage_charges"),
      del("instructor_memberships"),
      del("instructor_fee_overrides"),
      del("soap_notes"),
      del("email_logs"),
      del("messages"),
      ...(memberIdsForDelete && memberIdsForDelete.length > 0
        ? [adminSupabase.from("pass_subscriptions").delete().in("member_id", memberIdsForDelete.map((m) => m.id))]
        : []),
    ]);

    // Layer 2: depends on layer 1 being cleared
    await Promise.all([
      del("bookings"),
      del("events"),
      del("class_sessions"),
    ]);

    // Layer 3: depends on layer 2
    await Promise.all([
      del("classes"),
      del("class_templates"),
      del("members"),
      del("managers"),
      del("instructors"),
    ]);

    // Layer 4: studio settings & metadata
    await Promise.all([
      del("instructor_membership_tiers"),
      del("instructor_invite_tokens"),
      del("studio_features"),
      del("widget_settings"),
      del("waiver_templates"),
      del("products"),
      del("referral_codes"),
      adminSupabase.from("referral_rewards").delete().eq("referrer_studio_id", studioId),
      adminSupabase.from("referral_rewards").delete().eq("referred_studio_id", studioId),
      del("rooms"),
    ]);

    // Layer 5: profiles & studio (must be last)
    await del("profiles");
    await adminSupabase.from("studios").delete().eq("id", studioId);

    // Delete auth users (parallelized)
    await Promise.allSettled(
      userIdsToDelete.map((uid) => adminSupabase.auth.admin.deleteUser(uid)),
    );

    // Sign out the current user
    await serverSupabase.auth.signOut();

    return NextResponse.json({
      success: true,
      ...(failedCancellations.length > 0 && {
        warning: `${failedCancellations.length} Stripe subscription(s) could not be cancelled automatically. Please check Stripe dashboard.`,
      }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
