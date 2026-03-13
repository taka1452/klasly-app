import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import {
  bookingConfirmation,
  bookingCancelled,
  waitlistPromoted,
} from "@/lib/email/templates";
import { formatDate, formatTime } from "@/lib/utils";
import { getRequiresCredits } from "@/lib/booking-utils";

type BookingAction = "book" | "rebook" | "cancel" | "leave_waitlist";

type BookingParams = {
  adminSupabase: SupabaseClient;
  userId: string;
  action: BookingAction;
  sessionId: string;
  memberId: string;
};

type BookingResult = {
  success: boolean;
  error?: string;
  status?: number;
};

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
    .select("id, session_date, start_time, capacity, classes(name)")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return { success: false, error: "Session not found", status: 404 };
  }

  const className =
    (session as { classes?: { name?: string } }).classes?.name ?? "Class";
  const memberName = profile?.full_name ?? "Member";
  const memberEmail = profile?.email ?? "";
  const studioName = studio?.name ?? "Studio";
  const sessionDate = formatDate(session.session_date);
  const startTime = formatTime(session.start_time);

  const emailPayload = {
    memberName,
    className,
    sessionDate,
    startTime,
    studioName,
  };

  // スタジオ設定に基づきクレジット要否を判定
  const requiresCredits = getRequiresCredits({
    booking_requires_credits: (studio as { booking_requires_credits?: boolean | null })?.booking_requires_credits ?? null,
    stripe_connect_onboarding_complete: (studio as { stripe_connect_onboarding_complete?: boolean })?.stripe_connect_onboarding_complete ?? false,
  });

  let promotedMemberEmail: string | null = null;
  let promotedMemberName: string | null = null;

  if (action === "book" || action === "rebook") {
    const { count: confirmedCount } = await adminSupabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("status", "confirmed");

    const isFull = (confirmedCount ?? 0) >= session.capacity;
    const status = isFull ? "waitlist" : "confirmed";

    if (requiresCredits && status === "confirmed" && member.credits >= 0 && member.credits < 1) {
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
        .update({ status })
        .eq("id", existing.id);

      if (error) {
        return { success: false, error: error.message, status: 400 };
      }

      if (status === "confirmed" && member.credits >= 0) {
        await adminSupabase
          .from("members")
          .update({ credits: member.credits - 1 })
          .eq("id", memberId);
      }

      if (status === "confirmed" && memberEmail) {
        const { subject, html } = bookingConfirmation(emailPayload);
        await sendEmail({ to: memberEmail, subject, html });
      }
    } else {
      // book
      const { error } = await adminSupabase.from("bookings").insert({
        studio_id: member.studio_id,
        session_id: sessionId,
        member_id: memberId,
        status,
      });

      if (error) {
        return { success: false, error: error.message, status: 400 };
      }

      if (status === "confirmed" && member.credits >= 0) {
        await adminSupabase
          .from("members")
          .update({ credits: member.credits - 1 })
          .eq("id", memberId);
      }

      if (status === "confirmed" && memberEmail) {
        const { subject, html } = bookingConfirmation(emailPayload);
        await sendEmail({ to: memberEmail, subject, html });
      }
    }
  } else if (action === "cancel") {
    const { data: existing } = await adminSupabase
      .from("bookings")
      .select("id, status")
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

    // ウェイトリスト予約はクレジット消費していないので返却しない
    if (existing.status === "confirmed" && member.credits >= 0) {
      await adminSupabase
        .from("members")
        .update({ credits: member.credits + 1 })
        .eq("id", memberId);
    }

    if (memberEmail) {
      const { subject, html } = bookingCancelled(emailPayload);
      await sendEmail({ to: memberEmail, subject, html });
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
        }

        await adminSupabase
          .from("bookings")
          .update({ status: "confirmed" })
          .eq("session_id", sessionId)
          .eq("member_id", waitlistItem.member_id);

        if (waitlistMember.credits > 0) {
          await adminSupabase
            .from("members")
            .update({ credits: waitlistMember.credits - 1 })
            .eq("id", waitlistItem.member_id);
        }

        break;
      }
    }

    if (promotedMemberEmail && promotedMemberName) {
      const { subject, html } = waitlistPromoted({
        ...emailPayload,
        memberName: promotedMemberName,
      });
      await sendEmail({ to: promotedMemberEmail, subject, html });
    }
  } else if (action === "leave_waitlist") {
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
      .update({ status: "cancelled" })
      .eq("id", existing.id);

    if (error) {
      return { success: false, error: error.message, status: 400 };
    }
  }

  return { success: true };
}
