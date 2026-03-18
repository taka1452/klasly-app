import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { bookingCancelled, waitlistPromoted } from "@/lib/email/templates";
import { formatDate, formatTime } from "@/lib/utils";

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

    if (!ownerProfile?.studio_id || ownerProfile.role !== "owner") {
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
        // Revert pass usage: delete pass_class_usage and decrement counter
        const { data: usageRows } = await adminSupabase
          .from("pass_class_usage")
          .select("id, pass_subscription_id, pass_subscriptions(id, member_id, classes_used_this_period)")
          .eq("session_id", booking.session_id);

        if (usageRows) {
          for (const usage of usageRows) {
            const sub = usage.pass_subscriptions as unknown as {
              id: string;
              member_id: string;
              classes_used_this_period: number;
            } | null;
            if (!sub || sub.member_id !== booking.member_id) continue;

            await Promise.all([
              adminSupabase.from("pass_class_usage").delete().eq("id", usage.id),
              adminSupabase
                .from("pass_subscriptions")
                .update({
                  classes_used_this_period: Math.max(0, sub.classes_used_this_period - 1),
                })
                .eq("id", sub.id),
            ]);
            break;
          }
        }
      } else if (member && member.credits >= 0) {
        await adminSupabase
          .from("members")
          .update({ credits: member.credits + 1 })
          .eq("id", booking.member_id);
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

    // ウェイトリスト昇格（確認済み予約のキャンセルの場合）
    if (wasConfirmed && session) {
      const { count: confirmedCount } = await adminSupabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("session_id", booking.session_id)
        .eq("status", "confirmed");

      if ((confirmedCount ?? 0) < session.capacity) {
        const { data: firstWaitlist } = await adminSupabase
          .from("bookings")
          .select("member_id")
          .eq("session_id", booking.session_id)
          .eq("status", "waitlist")
          .order("created_at", { ascending: true })
          .limit(1)
          .single();

        if (firstWaitlist) {
          await adminSupabase
            .from("bookings")
            .update({ status: "confirmed" })
            .eq("session_id", booking.session_id)
            .eq("member_id", firstWaitlist.member_id);

          const { data: promotedMember } = await adminSupabase
            .from("members")
            .select("credits, profile_id")
            .eq("id", firstWaitlist.member_id)
            .single();

          if (promotedMember && promotedMember.credits >= 0) {
            await adminSupabase
              .from("members")
              .update({ credits: promotedMember.credits - 1 })
              .eq("id", firstWaitlist.member_id);
          }

          if (promotedMember) {
            const { data: promotedProfile } = await adminSupabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", promotedMember.profile_id)
              .single();

            if (promotedProfile?.email) {
              const { subject, html } = waitlistPromoted({
                ...emailPayload,
                memberName: promotedProfile.full_name ?? "Member",
              });
              await sendEmail({ to: promotedProfile.email, subject, html });
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
