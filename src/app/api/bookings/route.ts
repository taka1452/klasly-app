import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import {
  bookingConfirmation,
  bookingCancelled,
  waitlistPromoted,
} from "@/lib/email/templates";
import { formatDate, formatTime } from "@/lib/utils";

export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const { action, sessionId, memberId } = body;

    if (!["book", "rebook", "cancel", "leave_waitlist"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    if (!sessionId || !memberId) {
      return NextResponse.json(
        { error: "Missing sessionId or memberId" },
        { status: 400 }
      );
    }

    const { data: member } = await adminSupabase
      .from("members")
      .select("id, profile_id, credits, studio_id")
      .eq("id", memberId)
      .single();

    if (!member || member.profile_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", member.profile_id)
      .single();

    const { data: studio } = await adminSupabase
      .from("studios")
      .select("name")
      .eq("id", member.studio_id)
      .single();

    const { data: session } = await adminSupabase
      .from("class_sessions")
      .select("id, session_date, start_time, capacity, classes(name)")
      .eq("id", sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const className =
      (session as { classes?: { name?: string } }).classes?.name ?? "Class";

    const memberName = profile?.full_name ?? "Member";
    const memberEmail = profile?.email ?? user.email ?? "";
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

      if (status === "confirmed" && member.credits >= 0 && member.credits < 1) {
        return NextResponse.json(
          { error: "No credits remaining" },
          { status: 400 }
        );
      }

      if (action === "rebook") {
        const { data: existing } = await adminSupabase
          .from("bookings")
          .select("id")
          .eq("session_id", sessionId)
          .eq("member_id", memberId)
          .single();

        if (!existing) {
          return NextResponse.json(
            { error: "Booking not found" },
            { status: 404 }
          );
        }

        const { error } = await adminSupabase
          .from("bookings")
          .update({ status })
          .eq("id", existing.id);

        if (error) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }

        if (status === "confirmed" && member.credits >= 0) {
          await adminSupabase
            .from("members")
            .update({ credits: member.credits - 1 })
            .eq("id", memberId);
        }

        if (status === "confirmed" && memberEmail) {
          const { subject, html } = bookingConfirmation(emailPayload);
          sendEmail({ to: memberEmail, subject, html });
        }
      } else {
        const { error } = await adminSupabase.from("bookings").insert({
          studio_id: member.studio_id,
          session_id: sessionId,
          member_id: memberId,
          status,
        });

        if (error) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }

        if (status === "confirmed" && member.credits >= 0) {
          await adminSupabase
            .from("members")
            .update({ credits: member.credits - 1 })
            .eq("id", memberId);
        }

        if (status === "confirmed" && memberEmail) {
          const { subject, html } = bookingConfirmation(emailPayload);
          sendEmail({ to: memberEmail, subject, html });
        }
      }
    } else if (action === "cancel") {
      const { data: existing } = await adminSupabase
        .from("bookings")
        .select("id")
        .eq("session_id", sessionId)
        .eq("member_id", memberId)
        .single();

      if (!existing) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }

      const { error } = await adminSupabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", existing.id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      if (member.credits >= 0) {
        await adminSupabase
          .from("members")
          .update({ credits: member.credits + 1 })
          .eq("id", memberId);
      }

      if (memberEmail) {
        const { subject, html } = bookingCancelled(emailPayload);
        sendEmail({ to: memberEmail, subject, html });
      }

      const { count: confirmedCount } = await adminSupabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("status", "confirmed");

      if ((confirmedCount ?? 0) < session.capacity) {
        const { data: firstWaitlist } = await adminSupabase
          .from("bookings")
          .select("member_id")
          .eq("session_id", sessionId)
          .eq("status", "waitlist")
          .order("created_at", { ascending: true })
          .limit(1)
          .single();

        if (firstWaitlist) {
          const { data: promotedProfile } = await adminSupabase
            .from("members")
            .select("profile_id")
            .eq("id", firstWaitlist.member_id)
            .single();

          if (promotedProfile) {
            const { data: promoted } = await adminSupabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", promotedProfile.profile_id)
              .single();

            if (promoted?.email) {
              promotedMemberEmail = promoted.email;
              promotedMemberName = promoted.full_name ?? "Member";
            }
          }

          await adminSupabase
            .from("bookings")
            .update({ status: "confirmed" })
            .eq("session_id", sessionId)
            .eq("member_id", firstWaitlist.member_id);

          const promotedMember = await adminSupabase
            .from("members")
            .select("credits")
            .eq("id", firstWaitlist.member_id)
            .single();

          if (promotedMember.data && promotedMember.data.credits >= 0) {
            await adminSupabase
              .from("members")
              .update({
                credits: promotedMember.data.credits - 1,
              })
              .eq("id", firstWaitlist.member_id);
          }
        }
      }

      if (promotedMemberEmail && promotedMemberName) {
        const { subject, html } = waitlistPromoted({
          ...emailPayload,
          memberName: promotedMemberName,
        });
        sendEmail({ to: promotedMemberEmail, subject, html });
      }
    } else if (action === "leave_waitlist") {
      const { data: existing } = await adminSupabase
        .from("bookings")
        .select("id")
        .eq("session_id", sessionId)
        .eq("member_id", memberId)
        .single();

      if (!existing) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }

      const { error } = await adminSupabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", existing.id);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
