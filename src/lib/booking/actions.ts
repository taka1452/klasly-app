import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import {
  bookingConfirmation,
  bookingCancelled,
  waitlistPromoted,
} from "@/lib/email/templates";
import { sendPushNotification } from "@/lib/push/send";
import {
  pushBookingConfirmation,
  pushBookingCancelled,
  pushWaitlistPromoted,
} from "@/lib/push/templates";
import { formatDate, formatTime } from "@/lib/utils";
import { getRequiresCredits } from "@/lib/booking-utils";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { unwrapRelation } from "@/lib/supabase/relation";
import { logger } from "@/lib/logger";

type BookingAction = "book" | "rebook" | "cancel" | "leave_waitlist";

type BookingParams = {
  adminSupabase: SupabaseClient;
  userId: string;
  action: BookingAction;
  sessionId: string;
  memberId: string;
  /** When true, the member explicitly chose to use their pass for this booking */
  usePass?: boolean;
};

type BookingResult = {
  success: boolean;
  error?: string;
  status?: number;
};

/**
 * Check if a member has an active pass with remaining capacity.
 * Returns the pass subscription + pass details if available, or null.
 */
async function getActivePass(adminSupabase: SupabaseClient, memberId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: passSubs } = await adminSupabase
    .from("pass_subscriptions")
    .select("id, studio_pass_id, classes_used_this_period, studio_passes(id, max_classes_per_month)")
    .eq("member_id", memberId)
    .eq("status", "active")
    .gte("current_period_end", today);

  if (!passSubs || passSubs.length === 0) return null;

  // Find first pass with remaining capacity
  for (const sub of passSubs) {
    const pass = unwrapRelation<{ id: string; max_classes_per_month: number | null }>(sub.studio_passes);
    if (!pass) continue;

    const maxClasses = pass.max_classes_per_month;
    const used = sub.classes_used_this_period ?? 0;

    // null means unlimited, or check if under limit
    if (maxClasses === null || used < maxClasses) {
      return {
        subscriptionId: sub.id,
        passId: pass.id,
        maxClasses,
        classesUsed: used,
        hasCapacity: true,
      };
    }
  }

  // All passes are at capacity
  const firstSub = passSubs[0];
  const firstPass = unwrapRelation<{ id: string; max_classes_per_month: number | null }>(firstSub.studio_passes);
  return {
    subscriptionId: firstSub.id,
    passId: firstPass?.id ?? "",
    maxClasses: firstPass?.max_classes_per_month ?? 0,
    classesUsed: firstSub.classes_used_this_period ?? 0,
    hasCapacity: false,
  };
}

/**
 * Record pass usage: insert pass_class_usage and atomically increment classes_used_this_period.
 */
async function recordPassUsage(
  adminSupabase: SupabaseClient,
  passSubscriptionId: string,
  sessionId: string,
  instructorId: string,
  _classesUsed: number
) {
  // Insert usage record first — if it fails (e.g. unique constraint), don't touch the counter
  const { error } = await adminSupabase.from("pass_class_usage").insert({
    pass_subscription_id: passSubscriptionId,
    session_id: sessionId,
    instructor_id: instructorId,
  });
  if (error) {
    logger.error("recordPassUsage insert failed", { error: error.message });
    return;
  }
  // Atomically increment counter after successful insert
  await adminSupabase.rpc("increment_pass_usage", {
    p_subscription_id: passSubscriptionId,
  });
}

/**
 * Revert pass usage on cancel: delete pass_class_usage and decrement counter.
 */
async function revertPassUsage(
  adminSupabase: SupabaseClient,
  bookingSessionId: string,
  memberId: string
) {
  // Find the pass_class_usage record for this session
  const { data: usageRows } = await adminSupabase
    .from("pass_class_usage")
    .select("id, pass_subscription_id, pass_subscriptions(id, member_id, classes_used_this_period)")
    .eq("session_id", bookingSessionId);

  if (!usageRows) return;

  for (const usage of usageRows) {
    const sub = unwrapRelation<{
      id: string;
      member_id: string;
      classes_used_this_period: number;
    }>(usage.pass_subscriptions);
    if (!sub || sub.member_id !== memberId) continue;

    // Delete usage record first, then atomically decrement counter
    const { error: delErr } = await adminSupabase
      .from("pass_class_usage")
      .delete()
      .eq("id", usage.id);
    if (delErr) {
      logger.error("revertPassUsage delete failed", { error: delErr.message });
      break;
    }
    await adminSupabase.rpc("decrement_pass_usage", {
      p_subscription_id: sub.id,
    });
    break;
  }
}

/**
 * 予約アクション共通ロジック。
 * /api/bookings と /api/widget/[studioId]/bookings の両方から呼ばれる。
 */
export async function executeBookingAction({
  adminSupabase,
  userId,
  action,
  sessionId,
  memberId,
  usePass = false,
}: BookingParams): Promise<BookingResult> {
  // Validate action
  if (!["book", "rebook", "cancel", "leave_waitlist"].includes(action)) {
    return { success: false, error: "Invalid action", status: 400 };
  }

  if (!sessionId || !memberId) {
    return {
      success: false,
      error: "Missing sessionId or memberId",
      status: 400,
    };
  }

  // Verify member ownership
  const { data: member } = await adminSupabase
    .from("members")
    .select("id, profile_id, credits, studio_id")
    .eq("id", memberId)
    .single();

  if (!member || member.profile_id !== userId) {
    return { success: false, error: "Forbidden", status: 403 };
  }

  // Fetch profile, studio, session info
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", member.profile_id)
    .single();

  const { data: studio } = await adminSupabase
    .from("studios")
    .select("name, booking_requires_credits, stripe_connect_onboarding_complete")
    .eq("id", member.studio_id)
    .single();

  const { data: session } = await adminSupabase
    .from("class_sessions")
    .select("id, session_date, start_time, capacity, is_online, online_link, class_id, studio_id, classes(name, is_online, online_link, instructor_id)")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return { success: false, error: "Session not found", status: 404 };
  }

  // Verify session belongs to the same studio as the member
  if ((session as { studio_id?: string }).studio_id !== member.studio_id) {
    return { success: false, error: "Session not found", status: 404 };
  }

  const sessionAny = session as {
    class_id?: string;
    classes?: { name?: string; is_online?: boolean; online_link?: string | null; instructor_id?: string };
    is_online?: boolean;
    online_link?: string | null;
  };
  const className = sessionAny.classes?.name ?? "Class";
  const memberName = profile?.full_name ?? "Member";
  const memberEmail = profile?.email ?? "";
  const studioName = studio?.name ?? "Studio";
  const sessionDate = formatDate(session.session_date);
  const startTime = formatTime(session.start_time);
  // Session-level online overrides class-level
  const isOnline = sessionAny.is_online ?? sessionAny.classes?.is_online ?? false;
  const onlineLink = sessionAny.online_link ?? sessionAny.classes?.online_link ?? null;

  const emailPayload = {
    memberName,
    className,
    sessionDate,
    startTime,
    studioName,
    isOnline,
    onlineLink,
  };

  // スタジオ設定に基づきクレジット要否を判定
  const requiresCredits = getRequiresCredits({
    booking_requires_credits: (studio as { booking_requires_credits?: boolean | null })?.booking_requires_credits ?? null,
    stripe_connect_onboarding_complete: (studio as { stripe_connect_onboarding_complete?: boolean })?.stripe_connect_onboarding_complete ?? false,
  });

  let promotedMemberEmail: string | null = null;
  let promotedMemberName: string | null = null;
  let waitlistMemberProfileId: string | null = null;

  if (action === "book" || action === "rebook") {
    const { count: confirmedCount } = await adminSupabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("status", "confirmed");

    const isFull = (confirmedCount ?? 0) >= session.capacity;
    const status = isFull ? "waitlist" : "confirmed";

    // --- Pass check ---
    let bookingViaPass = false;
    let passInfo: Awaited<ReturnType<typeof getActivePass>> = null;

    if (usePass && status === "confirmed") {
      // Verify feature flag is enabled before allowing pass usage
      const passFeatureEnabled = await isFeatureEnabled(member.studio_id, FEATURE_KEYS.STUDIO_PASS);
      if (!passFeatureEnabled) {
        return { success: false, error: "Studio passes are not enabled", status: 403 };
      }

      passInfo = await getActivePass(adminSupabase, memberId);
      if (passInfo && passInfo.hasCapacity) {
        bookingViaPass = true;
      } else if (passInfo && !passInfo.hasCapacity) {
        return {
          success: false,
          error: "Pass limit reached. Book with regular payment?",
          status: 400,
        };
      } else {
        return {
          success: false,
          error: "No active pass found",
          status: 400,
        };
      }
    }

    // Credit check only when NOT using pass (preliminary check; atomic deduction below)
    if (!bookingViaPass && requiresCredits && status === "confirmed" && member.credits >= 0 && member.credits < 1) {
      return { success: false, error: "No credits remaining", status: 400 };
    }

    if (action === "book") {
      // 既存の非キャンセル予約チェック（重複防止）
      const { data: existingActive } = await adminSupabase
        .from("bookings")
        .select("id, status")
        .eq("session_id", sessionId)
        .eq("member_id", memberId)
        .neq("status", "cancelled")
        .maybeSingle();

      if (existingActive) {
        return {
          success: false,
          error:
            existingActive.status === "confirmed"
              ? "Already booked"
              : "Already on waitlist",
          status: 409,
        };
      }
    }

    if (action === "rebook") {
      const { data: existing } = await adminSupabase
        .from("bookings")
        .select("id")
        .eq("session_id", sessionId)
        .eq("member_id", memberId)
        .single();

      if (!existing) {
        return { success: false, error: "Booking not found", status: 404 };
      }

      const { error } = await adminSupabase
        .from("bookings")
        .update({ status, booked_via_pass: bookingViaPass })
        .eq("id", existing.id);

      if (error) {
        return { success: false, error: error.message, status: 400 };
      }

      // Atomic credit deduction: skip if booking via pass
      if (!bookingViaPass && status === "confirmed" && member.credits >= 0) {
        const { data: creditResult } = await adminSupabase.rpc("decrement_member_credits", {
          p_member_id: memberId,
        });
        if (creditResult === -99) {
          // Undo the booking update — insufficient credits (race condition caught)
          await adminSupabase.from("bookings").update({ status: "cancelled" }).eq("id", existing.id);
          return { success: false, error: "No credits remaining", status: 400 };
        }
      }

      // Record pass usage
      if (bookingViaPass && passInfo && status === "confirmed") {
        const instructorId = sessionAny.classes?.instructor_id;
        if (instructorId) {
          await recordPassUsage(
            adminSupabase,
            passInfo.subscriptionId,
            sessionId,
            instructorId,
            passInfo.classesUsed
          );
        }
      }

      if (status === "confirmed" && memberEmail) {
        const { subject, html } = bookingConfirmation(emailPayload);
        await sendEmail({ to: memberEmail, subject, html });
        // Push notification
        sendPushNotification({
          profileId: member.profile_id,
          studioId: member.studio_id,
          type: "booking_confirmation",
          payload: pushBookingConfirmation({ className, sessionDate, startTime }),
        }).catch((err) => logger.warn("Push notification failed", { error: err instanceof Error ? err.message : String(err) }));
      }
    } else {
      // book
      const { error } = await adminSupabase.from("bookings").insert({
        studio_id: member.studio_id,
        session_id: sessionId,
        member_id: memberId,
        status,
        booked_via_pass: bookingViaPass,
      });

      if (error) {
        return { success: false, error: error.message, status: 400 };
      }

      // Atomic credit deduction: skip if booking via pass
      if (!bookingViaPass && status === "confirmed" && member.credits >= 0) {
        const { data: creditResult } = await adminSupabase.rpc("decrement_member_credits", {
          p_member_id: memberId,
        });
        if (creditResult === -99) {
          // Undo the booking — insufficient credits (race condition caught)
          await adminSupabase.from("bookings").delete().eq("session_id", sessionId).eq("member_id", memberId);
          return { success: false, error: "No credits remaining", status: 400 };
        }
      }

      // Record pass usage
      if (bookingViaPass && passInfo && status === "confirmed") {
        const instructorId = sessionAny.classes?.instructor_id;
        if (instructorId) {
          await recordPassUsage(
            adminSupabase,
            passInfo.subscriptionId,
            sessionId,
            instructorId,
            passInfo.classesUsed
          );
        }
      }

      if (status === "confirmed" && memberEmail) {
        const { subject, html } = bookingConfirmation(emailPayload);
        await sendEmail({ to: memberEmail, subject, html });
        // Push notification
        sendPushNotification({
          profileId: member.profile_id,
          studioId: member.studio_id,
          type: "booking_confirmation",
          payload: pushBookingConfirmation({ className, sessionDate, startTime }),
        }).catch((err) => logger.warn("Push notification failed", { error: err instanceof Error ? err.message : String(err) }));
      }
    }
  } else if (action === "cancel") {
    const { data: existing } = await adminSupabase
      .from("bookings")
      .select("id, status, booked_via_pass")
      .eq("session_id", sessionId)
      .eq("member_id", memberId)
      .single();

    if (!existing) {
      return { success: false, error: "Booking not found", status: 404 };
    }

    const { error } = await adminSupabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", existing.id);

    if (error) {
      return { success: false, error: error.message, status: 400 };
    }

    if (existing.status === "confirmed") {
      if (existing.booked_via_pass) {
        // Revert pass usage (no credit refund needed)
        await revertPassUsage(adminSupabase, sessionId, memberId);
      } else if (member.credits >= 0) {
        // ウェイトリスト予約はクレジット消費していないので返却しない
        // Atomic credit increment
        await adminSupabase.rpc("increment_member_credits", {
          p_member_id: memberId,
        });
      }
    }

    if (memberEmail) {
      const { subject, html } = bookingCancelled(emailPayload);
      await sendEmail({ to: memberEmail, subject, html });
      // Push notification: cancellation
      sendPushNotification({
        profileId: member.profile_id,
        studioId: member.studio_id,
        type: "booking_cancellation",
        payload: pushBookingCancelled({ className, sessionDate, startTime }),
      }).catch((err) => logger.warn("Push notification failed", { error: err instanceof Error ? err.message : String(err) }));
    }

    // Waitlist promotion
    const { count: confirmedCount } = await adminSupabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("status", "confirmed");

    if ((confirmedCount ?? 0) < session.capacity) {
      const { data: waitlistQueue } = await adminSupabase
        .from("bookings")
        .select("member_id")
        .eq("session_id", sessionId)
        .eq("status", "waitlist")
        .order("created_at", { ascending: true });

      for (const waitlistItem of waitlistQueue || []) {
        const { data: waitlistMember } = await adminSupabase
          .from("members")
          .select("id, credits, profile_id")
          .eq("id", waitlistItem.member_id)
          .single();

        if (!waitlistMember) continue;

        // クレジット必須モードで credits === 0 のメンバーはスキップ
        if (requiresCredits && waitlistMember.credits === 0) continue;

        const { data: promoted } = await adminSupabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", waitlistMember.profile_id)
          .single();

        if (promoted?.email) {
          promotedMemberEmail = promoted.email;
          promotedMemberName = promoted.full_name ?? "Member";
          waitlistMemberProfileId = waitlistMember.profile_id;
        }

        // Atomically deduct credit before promoting
        if (requiresCredits && waitlistMember.credits > 0) {
          const { data: creditResult } = await adminSupabase.rpc("decrement_member_credits", {
            p_member_id: waitlistItem.member_id,
          });
          if (creditResult === -99) continue; // insufficient credits, skip
        }

        await adminSupabase
          .from("bookings")
          .update({ status: "confirmed" })
          .eq("session_id", sessionId)
          .eq("member_id", waitlistItem.member_id);

        break;
      }
    }

    if (promotedMemberEmail && promotedMemberName) {
      const { subject, html } = waitlistPromoted({
        ...emailPayload,
        memberName: promotedMemberName,
      });
      await sendEmail({ to: promotedMemberEmail, subject, html });
      // Push notification: waitlist promotion
      if (waitlistMemberProfileId) {
        sendPushNotification({
          profileId: waitlistMemberProfileId,
          studioId: member.studio_id,
          type: "waitlist_promotion",
          payload: pushWaitlistPromoted({ className, sessionDate, startTime }),
        }).catch((err) => logger.warn("Push notification failed", { error: err instanceof Error ? err.message : String(err) }));
      }
    }
  } else if (action === "leave_waitlist") {
    const { data: existing } = await adminSupabase
      .from("bookings")
      .select("id, status")
      .eq("session_id", sessionId)
      .eq("member_id", memberId)
      .single();

    if (!existing) {
      return { success: false, error: "Booking not found", status: 404 };
    }

    // Only allow leaving waitlist if actually on waitlist
    if (existing.status !== "waitlist") {
      return { success: false, error: "Booking is not on waitlist", status: 400 };
    }

    const { error } = await adminSupabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", existing.id);

    if (error) {
      return { success: false, error: error.message, status: 400 };
    }
  }

  return { success: true };
}
