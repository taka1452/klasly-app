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
  pushInstructorSoldOut,
} from "@/lib/push/templates";
import { formatDate, formatTime } from "@/lib/utils";
import { getRequiresCredits } from "@/lib/booking-utils";
import { isFeatureEnabled } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { unwrapRelation } from "@/lib/supabase/relation";
import { logger } from "@/lib/logger";
import { checkAndAwardAchievements } from "@/lib/achievements/compute";

type BookingAction = "book" | "rebook" | "cancel" | "leave_waitlist";

type BookingParams = {
  adminSupabase: SupabaseClient;
  userId: string;
  action: BookingAction;
  sessionId: string;
  memberId: string;
  /** When true, the member explicitly chose to use their pass for this booking */
  usePass?: boolean;
  /** For hybrid classes: 'in_person' or 'online' */
  attendanceMethod?: "in_person" | "online";
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
async function getActivePass(adminSupabase: SupabaseClient, memberId: string, classTemplateId?: string) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: passSubs } = await adminSupabase
    .from("pass_subscriptions")
    .select("id, studio_pass_id, classes_used_this_period, studio_passes(id, max_classes_per_month)")
    .eq("member_id", memberId)
    .eq("status", "active")
    .gte("current_period_end", today);

  if (!passSubs || passSubs.length === 0) return null;

  // Build a set of pass IDs that have class template restrictions
  // so we can skip passes that don't cover the requested class.
  let restrictedPassIds: Set<string> | null = null;
  let allowedPassIds: Set<string> | null = null;
  if (classTemplateId) {
    const passIds = passSubs.map((s) => s.studio_pass_id).filter(Boolean);
    const { data: restrictions } = await adminSupabase
      .from("pass_class_templates")
      .select("pass_id, template_id")
      .in("pass_id", passIds);
    if (restrictions && restrictions.length > 0) {
      restrictedPassIds = new Set(restrictions.map((r) => r.pass_id));
      allowedPassIds = new Set(
        restrictions.filter((r) => r.template_id === classTemplateId).map((r) => r.pass_id)
      );
    }
  }

  // Find first pass with remaining capacity that covers this class
  for (const sub of passSubs) {
    const pass = unwrapRelation<{ id: string; max_classes_per_month: number | null }>(sub.studio_passes);
    if (!pass) continue;

    // If this pass has class restrictions and doesn't include the requested class, skip it
    if (restrictedPassIds?.has(pass.id) && !allowedPassIds?.has(pass.id)) {
      continue;
    }

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

  // All passes are at capacity (or none cover this class)
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
  _classesUsed: number,
  maxClasses?: number | null
) {
  // Insert usage record first — if it fails (e.g. unique constraint), don't touch the counter
  const { error } = await adminSupabase.from("pass_class_usage").insert({
    pass_subscription_id: passSubscriptionId,
    session_id: sessionId,
    instructor_id: instructorId,
  });
  if (error) {
    logger.error("recordPassUsage insert failed", { error: error.message });
    return { success: false };
  }
  // Atomically check capacity + increment to prevent race condition
  const { data: result } = await adminSupabase.rpc("atomic_increment_pass_usage", {
    p_subscription_id: passSubscriptionId,
    p_max_classes: maxClasses ?? null,
  });
  if (result === -1) {
    // At capacity — undo the usage record
    await adminSupabase.from("pass_class_usage").delete()
      .eq("pass_subscription_id", passSubscriptionId)
      .eq("session_id", sessionId);
    return { success: false };
  }
  return { success: true };
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
 * Promote the first eligible waitlisted member of a session to "confirmed".
 *
 * Tries pass usage first (if feature enabled and member has an active pass
 * covering this class). Falls back to credit deduction. Skips members who
 * can't pay (0 credits in credit-required studios).
 *
 * Used by both executeBookingAction (cancel path) and the dedicated
 * /api/bookings/[id]/cancel endpoint so the promotion behavior stays
 * consistent across both flows.
 */
export async function promoteWaitlistedMember({
  adminSupabase,
  sessionId,
  studioId,
  classTemplateId,
  instructorId,
  requiresCredits,
  emailPayload,
  className,
}: {
  adminSupabase: SupabaseClient;
  sessionId: string;
  studioId: string;
  classTemplateId?: string;
  instructorId?: string;
  requiresCredits: boolean;
  emailPayload: { sessionDate: string; startTime: string; studioName: string };
  className: string;
}): Promise<void> {
  // Re-check capacity (race-safe: another booking could have filled the seat)
  const { data: sessionRow } = await adminSupabase
    .from("class_sessions")
    .select("capacity")
    .eq("id", sessionId)
    .single();
  if (!sessionRow) return;

  const { count: confirmedCount } = await adminSupabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("status", "confirmed");
  if ((confirmedCount ?? 0) >= sessionRow.capacity) return;

  // Walk the waitlist in FIFO order
  const { data: waitlistQueue } = await adminSupabase
    .from("bookings")
    .select("id, member_id")
    .eq("session_id", sessionId)
    .eq("status", "waitlist")
    .order("created_at", { ascending: true });

  if (!waitlistQueue || waitlistQueue.length === 0) return;

  const passFeatureEnabled = await isFeatureEnabled(studioId, FEATURE_KEYS.STUDIO_PASS);

  for (const waitlistItem of waitlistQueue) {
    const { data: waitlistMember } = await adminSupabase
      .from("members")
      .select("id, credits, profile_id")
      .eq("id", waitlistItem.member_id)
      .single();
    if (!waitlistMember) continue;

    let promotedViaPass = false;

    // Try pass first
    if (passFeatureEnabled) {
      const passInfo = await getActivePass(adminSupabase, waitlistItem.member_id, classTemplateId);
      if (passInfo && passInfo.hasCapacity && instructorId) {
        const passResult = await recordPassUsage(
          adminSupabase,
          passInfo.subscriptionId,
          sessionId,
          instructorId,
          passInfo.classesUsed,
          passInfo.maxClasses
        );
        if (passResult.success) {
          promotedViaPass = true;
        }
      }
    }

    if (!promotedViaPass) {
      // Skip members who can't pay
      if (requiresCredits && waitlistMember.credits === 0) continue;
      // Atomic credit deduction
      if (requiresCredits && waitlistMember.credits > 0) {
        const { data: creditResult } = await adminSupabase.rpc("decrement_member_credits", {
          p_member_id: waitlistItem.member_id,
        });
        if (creditResult === -99) continue;
      }
    }

    // Promote by booking ID for precision
    await adminSupabase
      .from("bookings")
      .update({ status: "confirmed", booked_via_pass: promotedViaPass })
      .eq("id", waitlistItem.id);

    // Notify the promoted member
    const { data: promotedProfile } = await adminSupabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", waitlistMember.profile_id)
      .single();

    if (promotedProfile?.email) {
      const { subject, html } = waitlistPromoted({
        ...emailPayload,
        memberName: promotedProfile.full_name ?? "Member",
        className,
      });
      await sendEmail({ to: promotedProfile.email, subject, html });
    }
    if (waitlistMember.profile_id) {
      sendPushNotification({
        profileId: waitlistMember.profile_id,
        studioId,
        type: "waitlist_promotion",
        payload: pushWaitlistPromoted({
          className,
          sessionDate: emailPayload.sessionDate,
          startTime: emailPayload.startTime,
        }),
      }).catch((err) =>
        logger.warn("Push notification failed", {
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }

    // Done — one promotion per cancellation
    return;
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
  attendanceMethod,
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
    .select("id, profile_id, credits, studio_id, waiver_signed, is_minor, date_of_birth, status")
    .eq("id", memberId)
    .single();

  if (!member || member.profile_id !== userId) {
    return { success: false, error: "Forbidden", status: 403 };
  }

  // Block bookings for paused/cancelled memberships. Cancels/leave_waitlist
  // are always allowed so members can clean up even if their status changed.
  const memberStatus = (member as { status?: string }).status;
  if ((action === "book" || action === "rebook") && memberStatus && memberStatus !== "active") {
    return {
      success: false,
      error: "Your membership is paused. Contact the studio to reactivate.",
      status: 403,
    };
  }

  // Server-side waiver enforcement (UI redirects too, but defence in depth
  // against direct API/widget calls). Only blocks bookings — cancels are
  // always allowed regardless of waiver state.
  if (action === "book" || action === "rebook") {
    // If the studio has a waiver template configured, the member must have
    // signed it. We check this by looking at members.waiver_signed.
    const { data: waiverTemplate } = await adminSupabase
      .from("waiver_templates")
      .select("id")
      .eq("studio_id", member.studio_id)
      .maybeSingle();

    if (waiverTemplate && !(member as { waiver_signed?: boolean }).waiver_signed) {
      return {
        success: false,
        error: "Please sign the waiver before booking.",
        status: 403,
      };
    }

    // Re-signing required when a member flagged as minor has aged out of
    // minor status. The original guardian signature is no longer valid
    // because they are now legally an adult.
    const dob = (member as { date_of_birth?: string | null }).date_of_birth;
    const isMinor = (member as { is_minor?: boolean }).is_minor;
    if (waiverTemplate && isMinor && dob) {
      const birth = new Date(dob);
      const ageMs = Date.now() - birth.getTime();
      const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
      if (ageYears >= 18) {
        return {
          success: false,
          error: "You've aged out of minor status. Please re-sign the waiver as an adult before booking.",
          status: 403,
        };
      }
    }
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
    .select("id, session_date, start_time, capacity, is_online, online_link, class_id, studio_id, title, classes(name, is_online, online_link, instructor_id)")
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
    title?: string;
    classes?: { name?: string; is_online?: boolean; online_link?: string | null; instructor_id?: string };
    is_online?: boolean;
    online_link?: string | null;
  };
  const className = sessionAny.title ?? sessionAny.classes?.name ?? "Class";
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

  if (action === "book" || action === "rebook") {
    // Capacity check for rebook path (book path uses atomic_book_session)
    let preCheckFull = false;
    if (action === "rebook") {
      const { count: confirmedCount } = await adminSupabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("status", "confirmed");
      preCheckFull = (confirmedCount ?? 0) >= session.capacity;
    }
    const status = preCheckFull ? "waitlist" : "confirmed";

    // --- Pass check ---
    let bookingViaPass = false;
    let passInfo: Awaited<ReturnType<typeof getActivePass>> = null;

    if (usePass && status === "confirmed") {
      // Verify feature flag is enabled before allowing pass usage
      const passFeatureEnabled = await isFeatureEnabled(member.studio_id, FEATURE_KEYS.STUDIO_PASS);
      if (!passFeatureEnabled) {
        return { success: false, error: "Studio passes are not enabled", status: 403 };
      }

      passInfo = await getActivePass(adminSupabase, memberId, session.class_id ?? undefined);
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
        .update({ status, booked_via_pass: bookingViaPass, attendance_method: attendanceMethod ?? null })
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

      // Record pass usage (atomic capacity check)
      if (bookingViaPass && passInfo && status === "confirmed") {
        const instructorId = sessionAny.classes?.instructor_id;
        if (instructorId) {
          const passResult = await recordPassUsage(
            adminSupabase,
            passInfo.subscriptionId,
            sessionId,
            instructorId,
            passInfo.classesUsed,
            passInfo.maxClasses
          );
          if (!passResult.success) {
            await adminSupabase.from("bookings").update({ status: "cancelled" }).eq("session_id", sessionId).eq("member_id", memberId);
            return { success: false, error: "Pass limit reached", status: 400 };
          }
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
      if (status === "confirmed") {
        notifySoldOutIfFull(adminSupabase, sessionId, session.capacity, sessionAny.classes?.instructor_id, member.studio_id, className, startTime);
      }
    } else {
      // book — use atomic DB function to prevent capacity race condition
      const { data: atomicStatus, error } = await adminSupabase.rpc("atomic_book_session", {
        p_session_id: sessionId,
        p_member_id: memberId,
        p_studio_id: member.studio_id,
        p_capacity: session.capacity,
        p_booked_via_pass: bookingViaPass,
        p_attendance_method: attendanceMethod ?? null,
      });

      if (error) {
        return { success: false, error: error.message, status: 400 };
      }

      // Use the status returned by the atomic function (may differ from pre-check)
      const finalStatus = atomicStatus as string;

      // Atomic credit deduction: skip if booking via pass
      if (!bookingViaPass && finalStatus === "confirmed" && member.credits >= 0) {
        const { data: creditResult } = await adminSupabase.rpc("decrement_member_credits", {
          p_member_id: memberId,
        });
        if (creditResult === -99) {
          // Undo the booking — insufficient credits (race condition caught)
          await adminSupabase.from("bookings").delete().eq("session_id", sessionId).eq("member_id", memberId);
          return { success: false, error: "No credits remaining", status: 400 };
        }
      }

      // Record pass usage (atomic capacity check)
      if (bookingViaPass && passInfo && finalStatus === "confirmed") {
        const instructorId = sessionAny.classes?.instructor_id;
        if (instructorId) {
          const passResult = await recordPassUsage(
            adminSupabase,
            passInfo.subscriptionId,
            sessionId,
            instructorId,
            passInfo.classesUsed,
            passInfo.maxClasses
          );
          if (!passResult.success) {
            await adminSupabase.from("bookings").delete().eq("session_id", sessionId).eq("member_id", memberId);
            return { success: false, error: "Pass limit reached", status: 400 };
          }
        }
      }

      if (finalStatus === "confirmed" && memberEmail) {
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
      if (finalStatus === "confirmed") {
        notifySoldOutIfFull(adminSupabase, sessionId, session.capacity, sessionAny.classes?.instructor_id, member.studio_id, className, startTime);
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

    // Waitlist promotion — shared between this flow and /api/bookings/[id]/cancel
    await promoteWaitlistedMember({
      adminSupabase,
      sessionId,
      studioId: member.studio_id,
      classTemplateId: session.class_id ?? undefined,
      instructorId: sessionAny.classes?.instructor_id,
      requiresCredits,
      emailPayload: { sessionDate, startTime, studioName },
      className,
    });
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

  // Check achievements after booking actions (non-blocking)
  if (action === "book" || action === "rebook") {
    try {
      const achievementsEnabled = await isFeatureEnabled(member.studio_id, FEATURE_KEYS.ACHIEVEMENTS);
      if (achievementsEnabled) {
        await checkAndAwardAchievements(adminSupabase, memberId, member.studio_id);
      }
    } catch {
      // Non-critical: don't fail the booking if achievement check fails
    }
  }

  return { success: true };
}

/**
 * Fire-and-forget: if this booking just filled the session to capacity,
 * push a "Sold out 🎉" notification to the instructor.
 */
function notifySoldOutIfFull(
  adminSupabase: SupabaseClient,
  sessionId: string,
  capacity: number,
  instructorId: string | undefined,
  studioId: string,
  className: string,
  startTime: string
) {
  if (!instructorId || capacity <= 0) return;
  void (async () => {
    try {
      const { count } = await adminSupabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("status", "confirmed");
      if ((count ?? 0) < capacity) return;

      const { data: inst } = await adminSupabase
        .from("instructors")
        .select("profile_id")
        .eq("id", instructorId)
        .maybeSingle();
      const profileId = (inst as { profile_id?: string } | null)?.profile_id;
      if (!profileId) return;

      await sendPushNotification({
        profileId,
        studioId,
        type: "instructor_sold_out",
        payload: pushInstructorSoldOut({ className, startTime }),
      });
    } catch (err) {
      logger.warn("Sold-out push failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}
