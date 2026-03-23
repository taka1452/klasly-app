import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { bookingCancelled, waitlistPromoted } from "@/lib/email/templates";
import { sendPushNotification } from "@/lib/push/send";
import { pushBookingCancelled, pushWaitlistPromoted } from "@/lib/push/templates";
import { formatDate, formatTime } from "@/lib/utils";
import { unwrapRelation } from "@/lib/supabase/relation";
import { logger } from "@/lib/logger";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // オーナー確認
    const { data: ownerProfile } = await adminSupabase
      .from("profiles")
      .select("studio_id, role")
      .eq("id", user.id)
      .single();

    if (ownerProfile?.role === "manager") {
      const { data: mgr } = await adminSupabase
        .from("managers")
        .select("can_manage_bookings")
        .eq("profile_id", user.id)
        .eq("studio_id", ownerProfile.studio_id)
        .single();
      if (!mgr?.can_manage_bookings) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!ownerProfile?.studio_id || ownerProfile.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 予約取得
    const { data: booking } = await adminSupabase
      .from("bookings")
      .select("id, status, member_id, session_id, studio_id, booked_via_pass")
      .eq("id", bookingId)
      .single();

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // 同スタジオの予約か確認
    if (booking.studio_id !== ownerProfile.studio_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (booking.status === "cancelled") {
      return NextResponse.json({ error: "Booking already cancelled" }, { status: 400 });
    }

    const wasConfirmed = booking.status === "confirmed";

    // キャンセル実行
    const { error } = await adminSupabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 確認済み予約のみクレジット返却（パス予約の場合はパス利用を戻す）
    const { data: member } = await adminSupabase
      .from("members")
      .select("credits, profile_id")
      .eq("id", booking.member_id)
      .single();

    if (wasConfirmed) {
      if (booking.booked_via_pass) {
        // Revert pass usage: delete pass_class_usage then decrement counter (sequential for consistency)
        const { data: usageRows } = await adminSupabase
          .from("pass_class_usage")
          .select("id, pass_subscription_id, pass_subscriptions(id, member_id, classes_used_this_period)")
          .eq("session_id", booking.session_id);

        if (usageRows) {
          for (const usage of usageRows) {
            const sub = unwrapRelation<{
              id: string;
              member_id: string;
              classes_used_this_period: number;
            }>(usage.pass_subscriptions);
            if (!sub || sub.member_id !== booking.member_id) continue;

            // Delete first, then decrement (sequential to avoid inconsistency)
            const { error: delErr } = await adminSupabase
              .from("pass_class_usage")
              .delete()
              .eq("id", usage.id);
            if (delErr) {
              logger.error("pass_class_usage delete failed on cancel", { error: delErr.message });
              break;
            }
            await adminSupabase.rpc("decrement_pass_usage", {
              p_subscription_id: sub.id,
            });
            break;
          }
        }
      } else if (member && member.credits >= 0) {
        // Atomic credit increment
        await adminSupabase.rpc("increment_member_credits", {
          p_member_id: booking.member_id,
        });
      }
    }

    // セッション情報取得（メール用）
    const { data: session } = await adminSupabase
      .from("class_sessions")
      .select("session_date, start_time, capacity, classes(name)")
      .eq("id", booking.session_id)
      .single();

    const { data: memberProfile } = member
      ? await adminSupabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", member.profile_id)
          .single()
      : { data: null };

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("name")
      .eq("id", booking.studio_id)
      .single();

    const className = (session as { classes?: { name?: string } } | null)?.classes?.name ?? "Class";
    const emailPayload = {
      memberName: memberProfile?.full_name ?? "Member",
      className,
      sessionDate: session ? formatDate(session.session_date) : "",
      startTime: session ? formatTime(session.start_time) : "",
      studioName: studio?.name ?? "Studio",
    };

    if (memberProfile?.email) {
      const { subject, html } = bookingCancelled(emailPayload);
      await sendEmail({ to: memberProfile.email, subject, html });
    }
    // Push notification: cancellation
    if (member?.profile_id) {
      sendPushNotification({
        profileId: member.profile_id,
        studioId: booking.studio_id,
        type: "booking_cancellation",
        payload: pushBookingCancelled({
          className,
          sessionDate: emailPayload.sessionDate,
          startTime: emailPayload.startTime,
        }),
      }).catch((err) => logger.warn("Push notification failed", { error: err instanceof Error ? err.message : String(err) }));
    }

    // ウェイトリスト昇格（確認済み予約のキャンセルの場合）
    // Determine if credits are required for this studio
    const { data: studioSettings } = await adminSupabase
      .from("studios")
      .select("booking_requires_credits, stripe_connect_onboarding_complete")
      .eq("id", booking.studio_id)
      .single();
    const { getRequiresCredits } = await import("@/lib/booking-utils");
    const requiresCredits = getRequiresCredits({
      booking_requires_credits: (studioSettings as { booking_requires_credits?: boolean | null })?.booking_requires_credits ?? null,
      stripe_connect_onboarding_complete: (studioSettings as { stripe_connect_onboarding_complete?: boolean })?.stripe_connect_onboarding_complete ?? false,
    });

    if (wasConfirmed && session) {
      const { count: confirmedCount } = await adminSupabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("session_id", booking.session_id)
        .eq("status", "confirmed");

      if ((confirmedCount ?? 0) < session.capacity) {
        // Find waitlisted members and promote the first eligible one
        const { data: waitlistQueue } = await adminSupabase
          .from("bookings")
          .select("id, member_id")
          .eq("session_id", booking.session_id)
          .eq("status", "waitlist")
          .order("created_at", { ascending: true });

        for (const waitlistItem of waitlistQueue || []) {
          const { data: waitlistMember } = await adminSupabase
            .from("members")
            .select("id, credits, profile_id")
            .eq("id", waitlistItem.member_id)
            .single();

          if (!waitlistMember) continue;

          // Skip members with 0 credits in credit-required mode
          if (requiresCredits && waitlistMember.credits === 0) continue;

          // Atomically deduct credit before promoting
          if (requiresCredits && waitlistMember.credits > 0) {
            const { data: creditResult } = await adminSupabase.rpc("decrement_member_credits", {
              p_member_id: waitlistItem.member_id,
            });
            if (creditResult === -99) continue; // insufficient credits, skip
          }

          // Promote using booking ID for precision
          await adminSupabase
            .from("bookings")
            .update({ status: "confirmed" })
            .eq("id", waitlistItem.id);

          // Send promotion email
          const { data: promotedProfile } = await adminSupabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", waitlistMember.profile_id)
            .single();

          if (promotedProfile?.email) {
            const { subject, html } = waitlistPromoted({
              ...emailPayload,
              memberName: promotedProfile.full_name ?? "Member",
            });
            await sendEmail({ to: promotedProfile.email, subject, html });
            // Push notification: waitlist promotion
            if (waitlistMember.profile_id) {
              sendPushNotification({
                profileId: waitlistMember.profile_id,
                studioId: booking.studio_id,
                type: "waitlist_promotion",
                payload: pushWaitlistPromoted({
                  className,
                  sessionDate: emailPayload.sessionDate,
                  startTime: emailPayload.startTime,
                }),
              }).catch((err) => logger.warn("Push notification failed", { error: err instanceof Error ? err.message : String(err) }));
            }
          }

          break;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
