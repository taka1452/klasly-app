import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendEmail } from "@/lib/email/send";
import { classBookingReminder } from "@/lib/email/templates";
import { formatDate, formatTime } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

type SessionRow = {
  id: string;
  session_date: string;
  start_time: string;
  studio_id: string;
  title: string | null;
  is_online: boolean | null;
  online_link: string | null;
  is_cancelled: boolean | null;
  classes: { name: string | null } | { name: string | null }[] | null;
};

type BookingRow = {
  id: string;
  session_id: string;
  member_id: string;
  status: string;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
};

/**
 * Hourly cron — emails class reminders in two windows:
 *
 *   24h: sessions starting in [now + 23h, now + 25h]
 *   1h:  sessions starting in [now + 30min, now + 90min]
 *
 * Each booking has its own reminder_*_sent_at timestamp so we never
 * double-send. Cancellation and non-confirmed bookings are excluded.
 *
 * The cron is intended to run every hour (or more frequent) so each
 * booking gets exactly one 24h reminder and one 1h reminder before
 * the session.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminDb = createAdminClient();
  const cronStartedAt = new Date().toISOString();
  let cronLogId: string | null = null;
  try {
    const { data: logRow } = await adminDb
      .from("cron_logs")
      .insert({
        job_name: "class-email-reminder",
        status: "running",
        started_at: cronStartedAt,
      })
      .select("id")
      .single();
    cronLogId = logRow?.id ?? null;
  } catch {
    // best-effort
  }

  try {
    const now = new Date();

    type Window = {
      label: "24h" | "1h";
      start: Date;
      end: Date;
      column: "reminder_24h_sent_at" | "reminder_1h_sent_at";
    };

    const windows: Window[] = [
      {
        label: "24h",
        start: new Date(now.getTime() + 23 * 60 * 60 * 1000),
        end: new Date(now.getTime() + 25 * 60 * 60 * 1000),
        column: "reminder_24h_sent_at",
      },
      {
        label: "1h",
        start: new Date(now.getTime() + 30 * 60 * 1000),
        end: new Date(now.getTime() + 90 * 60 * 1000),
        column: "reminder_1h_sent_at",
      },
    ];

    let totalSent = 0;
    let totalSkipped = 0;

    for (const w of windows) {
      // Find sessions whose session_date+start_time falls in this window.
      // We pull all sessions matching the date range and filter the time
      // band in JS (date-time math across midnight is awkward in pg
      // without timezone juggling).
      const startDate = w.start.toISOString().slice(0, 10);
      const endDate = w.end.toISOString().slice(0, 10);

      const { data: sessions } = await adminDb
        .from("class_sessions")
        .select(
          "id, session_date, start_time, studio_id, title, is_online, online_link, is_cancelled, classes(name)"
        )
        .gte("session_date", startDate)
        .lte("session_date", endDate)
        .eq("is_cancelled", false);

      const eligibleSessionIds: string[] = [];
      const sessionById = new Map<string, SessionRow>();
      for (const s of (sessions ?? []) as SessionRow[]) {
        const [h, m] = s.start_time.split(":").map(Number);
        const [yy, mm, dd] = s.session_date.split("-").map(Number);
        const dt = new Date(yy, mm - 1, dd, h, m);
        if (dt >= w.start && dt <= w.end) {
          eligibleSessionIds.push(s.id);
          sessionById.set(s.id, s);
        }
      }

      if (eligibleSessionIds.length === 0) continue;

      const { data: bookings } = await adminDb
        .from("bookings")
        .select(
          "id, session_id, member_id, status, reminder_24h_sent_at, reminder_1h_sent_at"
        )
        .in("session_id", eligibleSessionIds)
        .eq("status", "confirmed")
        .is(w.column, null);

      const sentBookingIds: string[] = [];
      for (const booking of (bookings ?? []) as BookingRow[]) {
        const session = sessionById.get(booking.session_id);
        if (!session) {
          totalSkipped++;
          continue;
        }

        // Fetch member email + name
        const { data: member } = await adminDb
          .from("members")
          .select("profile_id")
          .eq("id", booking.member_id)
          .single();
        if (!member) {
          totalSkipped++;
          continue;
        }
        const { data: profile } = await adminDb
          .from("profiles")
          .select("full_name, email")
          .eq("id", member.profile_id)
          .single();
        if (!profile?.email) {
          totalSkipped++;
          continue;
        }

        const { data: studio } = await adminDb
          .from("studios")
          .select("name")
          .eq("id", session.studio_id)
          .single();

        const rawClasses = session.classes;
        const classInfo = Array.isArray(rawClasses) ? rawClasses[0] : rawClasses;
        const className =
          session.title || classInfo?.name || "Class";

        const { subject, html } = classBookingReminder({
          memberName: profile.full_name || "there",
          className,
          sessionDate: formatDate(session.session_date),
          startTime: formatTime(session.start_time),
          studioName: studio?.name || "your studio",
          isOnline: !!session.is_online,
          onlineLink: session.online_link,
          window: w.label,
        });

        try {
          await sendEmail({
            to: profile.email,
            subject,
            html,
            studioId: session.studio_id,
            templateName: `class_booking_reminder_${w.label}`,
          });
          sentBookingIds.push(booking.id);
          totalSent++;
        } catch {
          totalSkipped++;
        }
      }

      // Bulk-mark sent so we don't re-send next hour.
      if (sentBookingIds.length > 0) {
        await adminDb
          .from("bookings")
          .update({ [w.column]: new Date().toISOString() })
          .in("id", sentBookingIds);
      }
    }

    if (cronLogId) {
      await adminDb
        .from("cron_logs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          details: { sent: totalSent, skipped: totalSkipped },
        })
        .eq("id", cronLogId);
    }
    return NextResponse.json({ sent: totalSent, skipped: totalSkipped });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (cronLogId) {
      await adminDb
        .from("cron_logs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          details: { error: message },
        })
        .eq("id", cronLogId);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
