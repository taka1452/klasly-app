import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/admin/supabase";
import { sendPushNotification } from "@/lib/push/send";
import { pushManagerMorningTodo } from "@/lib/push/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

const PASS_EXPIRY_WINDOW_DAYS = 7;
const LOW_FILL_THRESHOLD = 0.5;

/**
 * Daily morning push for studio owners + managers — surfaces what
 * needs attention today (waitlist bookings, failed payments,
 * expiring passes, tomorrow's poorly filled classes).
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
        job_name: "manager-morning-todo",
        status: "running",
        started_at: cronStartedAt,
      })
      .select("id")
      .single();
    cronLogId = logRow?.id ?? null;
  } catch {
    /* ignore */
  }

  try {
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(now.getUTCDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);
    const expiryCutoff = new Date(now);
    expiryCutoff.setUTCDate(now.getUTCDate() + PASS_EXPIRY_WINDOW_DAYS);
    const expiryCutoffIso = expiryCutoff.toISOString().slice(0, 10);
    const failedPaymentsSince = new Date(now);
    failedPaymentsSince.setUTCDate(now.getUTCDate() - 7);

    const { data: studios } = await adminDb.from("studios").select("id");
    if (!studios?.length) return NextResponse.json({ sent: 0 });

    let totalSent = 0;

    for (const studio of studios as { id: string }[]) {
      // Counts in parallel
      const [
        { count: pending },
        { count: failed },
        { count: passesExpiring },
        { data: tomorrowSessions },
      ] = await Promise.all([
        adminDb
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("studio_id", studio.id)
          .eq("status", "waitlist"),
        adminDb
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("studio_id", studio.id)
          .eq("status", "failed")
          .gte("created_at", failedPaymentsSince.toISOString()),
        adminDb
          .from("pass_subscriptions")
          .select("id, studio_passes!inner(studio_id)", {
            count: "exact",
            head: true,
          })
          .eq("status", "active")
          .eq("studio_passes.studio_id", studio.id)
          .gte("current_period_end", todayIso)
          .lte("current_period_end", expiryCutoffIso),
        adminDb
          .from("class_sessions")
          .select("id, capacity")
          .eq("studio_id", studio.id)
          .eq("session_date", tomorrowIso)
          .eq("is_cancelled", false)
          .eq("session_type", "class"),
      ]);

      let lowFillTomorrow = 0;
      const sessions = (tomorrowSessions ?? []) as Array<{
        id: string;
        capacity: number;
      }>;
      if (sessions.length > 0) {
        const sessionIds = sessions.map((s) => s.id);
        const { data: bookingCounts } = await adminDb
          .from("bookings")
          .select("session_id")
          .in("session_id", sessionIds)
          .eq("status", "confirmed");
        const counts = new Map<string, number>();
        for (const row of bookingCounts ?? []) {
          const id = (row as { session_id: string }).session_id;
          counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        for (const s of sessions) {
          const booked = counts.get(s.id) ?? 0;
          if (s.capacity > 0 && booked / s.capacity < LOW_FILL_THRESHOLD) {
            lowFillTomorrow += 1;
          }
        }
      }

      const payload = pushManagerMorningTodo({
        pendingBookings: pending ?? 0,
        failedPayments: failed ?? 0,
        passesExpiringSoon: passesExpiring ?? 0,
        lowFillTomorrow,
      });

      // Recipients: owner + managers
      const { data: owner } = await adminDb
        .from("profiles")
        .select("id")
        .eq("studio_id", studio.id)
        .eq("role", "owner")
        .maybeSingle();
      const { data: managerRows } = await adminDb
        .from("managers")
        .select("profile_id")
        .eq("studio_id", studio.id);

      const recipientIds = new Set<string>();
      if (owner?.id) recipientIds.add(owner.id);
      for (const m of (managerRows ?? []) as { profile_id: string }[]) {
        if (m.profile_id) recipientIds.add(m.profile_id);
      }

      for (const profileId of Array.from(recipientIds)) {
        try {
          const r = await sendPushNotification({
            profileId,
            studioId: studio.id,
            type: "manager_morning_todo",
            payload,
          });
          totalSent += r.sent;
        } catch (err) {
          console.error("manager-morning-todo push failed:", err);
        }
      }
    }

    if (cronLogId) {
      await adminDb
        .from("cron_logs")
        .update({
          status: "success",
          affected_count: totalSent,
          completed_at: new Date().toISOString(),
        })
        .eq("id", cronLogId);
    }

    return NextResponse.json({ sent: totalSent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (cronLogId) {
      await adminDb
        .from("cron_logs")
        .update({
          status: "error",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", cronLogId);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
