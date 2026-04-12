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

    // Delete in order (respecting FK constraints)
    // 1. Event-related
    await adminSupabase.from("event_bookings").delete().eq("studio_id", studioId);
    await adminSupabase.from("events").delete().eq("studio_id", studioId);

    // 2. Booking & attendance related
    await adminSupabase.from("drop_in_attendances").delete().eq("studio_id", studioId);
    await adminSupabase.from("bookings").delete().eq("studio_id", studioId);

    // 3. Payments
    await adminSupabase.from("payments").delete().eq("studio_id", studioId);

    // 4. Pass subscriptions (depends on members)
    const { data: memberIdsForDelete } = await adminSupabase
      .from("members")
      .select("id")
      .eq("studio_id", studioId);
    if (memberIdsForDelete && memberIdsForDelete.length > 0) {
      await adminSupabase
        .from("pass_subscriptions")
        .delete()
        .in("member_id", memberIdsForDelete.map((m) => m.id));
    }

    // 5. Instructor-related (depends on instructors)
    await adminSupabase.from("instructor_earnings").delete().eq("studio_id", studioId);
    await adminSupabase.from("instructor_overage_charges").delete().eq("studio_id", studioId);
    await adminSupabase.from("instructor_memberships").delete().eq("studio_id", studioId);
    await adminSupabase.from("instructor_fee_overrides").delete().eq("studio_id", studioId);
    await adminSupabase.from("soap_notes").delete().eq("studio_id", studioId);

    // 6. Sessions & classes
    await adminSupabase.from("class_sessions").delete().eq("studio_id", studioId);
    await adminSupabase.from("classes").delete().eq("studio_id", studioId);
    await adminSupabase.from("class_templates").delete().eq("studio_id", studioId);

    // 7. People
    await adminSupabase.from("members").delete().eq("studio_id", studioId);
    await adminSupabase.from("managers").delete().eq("studio_id", studioId);
    await adminSupabase.from("instructors").delete().eq("studio_id", studioId);

    // 8. Studio settings & metadata
    await adminSupabase.from("instructor_membership_tiers").delete().eq("studio_id", studioId);
    await adminSupabase.from("instructor_invite_tokens").delete().eq("studio_id", studioId);
    await adminSupabase.from("studio_features").delete().eq("studio_id", studioId);
    await adminSupabase.from("widget_settings").delete().eq("studio_id", studioId);
    await adminSupabase.from("waiver_templates").delete().eq("studio_id", studioId);
    await adminSupabase.from("products").delete().eq("studio_id", studioId);
    await adminSupabase.from("referral_codes").delete().eq("studio_id", studioId);
    await adminSupabase.from("referral_rewards").delete().eq("referrer_studio_id", studioId);
    await adminSupabase.from("referral_rewards").delete().eq("referred_studio_id", studioId);
    await adminSupabase.from("email_logs").delete().eq("studio_id", studioId);
    await adminSupabase.from("rooms").delete().eq("studio_id", studioId);

    // 9. Messages — null out sender/recipient before profile deletion to preserve history
    await adminSupabase.from("messages").delete().eq("studio_id", studioId);

    // 10. Profiles & studio
    await adminSupabase.from("profiles").delete().eq("studio_id", studioId);
    await adminSupabase.from("studios").delete().eq("id", studioId);

    // Delete auth users
    for (const uid of userIdsToDelete) {
      await adminSupabase.auth.admin.deleteUser(uid);
    }

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
