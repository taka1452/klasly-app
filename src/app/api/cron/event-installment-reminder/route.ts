import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { installmentReminder } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/admin/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
  );

  const cronStartedAt = new Date().toISOString();
  let cronLogId: string | null = null;
  try {
    const adminDb = createAdminClient();
    const { data: logRow } = await adminDb
      .from("cron_logs")
      .insert({
        job_name: "event-installment-reminder",
        status: "success",
        started_at: cronStartedAt,
      })
      .select("id")
      .single();
    cronLogId = logRow?.id ?? null;
  } catch {
    // non-blocking
  }

  let sentCount = 0;

  try {
    // Calculate the date 7 days from now
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + 7);
    const targetDate = reminderDate.toISOString().slice(0, 10);

    // Get pending installments due in 7 days — single JOIN query
    const { data: upcomingInstallments } = await supabase
      .from("event_payment_schedule")
      .select(`
        id, event_booking_id, amount_cents, due_date,
        event_bookings(guest_name, guest_email, event_id,
          events(name, studio_id)
        )
      `)
      .eq("status", "pending")
      .eq("due_date", targetDate);

    if (!upcomingInstallments || upcomingInstallments.length === 0) {
      await updateCronLog(cronLogId, "success", 0);
      return NextResponse.json({ sent: 0 });
    }

    const emailPromises: Promise<void>[] = [];
    for (const installment of upcomingInstallments) {
      const booking = installment.event_bookings as any;
      if (!booking?.guest_email) continue;
      const event = booking?.events;
      if (!event) continue;

      const mail = installmentReminder({
        guestName: booking.guest_name || "Guest",
        eventName: event.name,
        amount: installment.amount_cents,
        dueDate: installment.due_date,
      });

      emailPromises.push(
        sendEmail({
          to: booking.guest_email,
          subject: mail.subject,
          html: mail.html,
          studioId: event.studio_id,
          templateName: "installment_reminder",
        }).then(() => { sentCount++; })
          .catch((e) => {
            console.error(`[InstallmentReminder] Failed for schedule ${installment.id}:`, e);
          })
      );
    }
    await Promise.allSettled(emailPromises);

    await updateCronLog(cronLogId, "success", sentCount);
    return NextResponse.json({ sent: sentCount });
  } catch (err) {
    console.error("[InstallmentReminder] Fatal error:", err);
    await updateCronLog(cronLogId, "error", sentCount);
    return NextResponse.json(
      { error: "Internal error", sent: sentCount },
      { status: 500 },
    );
  }
}

async function updateCronLog(
  cronLogId: string | null,
  status: string,
  affected: number,
) {
  if (!cronLogId) return;
  try {
    const adminDb = createAdminClient();
    await adminDb
      .from("cron_logs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        affected_count: affected,
      })
      .eq("id", cronLogId);
  } catch {
    // non-blocking
  }
}
