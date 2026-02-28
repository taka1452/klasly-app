import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/admin/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Past due 7日超え → Grace に遷移
 * grace_period_ends_at が now+14 で設定されている場合、
 * 7日経過 = grace_period_ends_at <= now + 7
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const cronStartedAt = new Date().toISOString();
  let cronLogId: string | null = null;
  try {
    const adminDb = createAdminClient();
    const { data: logRow } = await adminDb
      .from("cron_logs")
      .insert({
        job_name: "past-due-check",
        status: "success",
        started_at: cronStartedAt,
      })
      .select("id")
      .single();
    cronLogId = logRow?.id ?? null;
  } catch {
    // ログ記録失敗はスキップ
  }

  try {
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const graceEnd = new Date(now);
  graceEnd.setDate(graceEnd.getDate() + 7);

  const { data: studios } = await supabase
    .from("studios")
    .select("id, name, grace_period_ends_at")
    .eq("plan_status", "past_due")
    .not("grace_period_ends_at", "is", null)
    .lte("grace_period_ends_at", sevenDaysFromNow.toISOString());

  if (!studios?.length) {
    try {
      if (cronLogId) {
        const adminDb = createAdminClient();
        await adminDb
          .from("cron_logs")
          .update({
            status: "success",
            affected_count: 0,
            details: {},
            completed_at: new Date().toISOString(),
          })
          .eq("id", cronLogId);
      }
    } catch {
      // ログ記録失敗はスキップ
    }
    return NextResponse.json({ processed: 0 });
  }

  let updated = 0;
  for (const studio of studios) {
    await supabase
      .from("studios")
      .update({
        plan_status: "grace",
        grace_period_ends_at: graceEnd.toISOString(),
      })
      .eq("id", studio.id);

    const { data: owner } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("studio_id", studio.id)
      .eq("role", "owner")
      .limit(1)
      .single();

    if (owner?.email) {
      const graceEndStr = graceEnd.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const subject = "Your Klasly account access will be restricted";
      const html = `
        <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Payment Update Required</h2>
        <p style="margin:0 0 8px;font-size:15px;">Hi ${owner.full_name || "Studio Owner"},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
          Your account access will be restricted. You have 7 days to update your payment.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
          Your account will be suspended on <strong>${graceEndStr}</strong> unless you update your payment method in Settings → Billing.
        </p>
        <p style="margin:0;font-size:14px;">Update your payment now to avoid losing access.</p>
      `;
      const wrapped = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#f9fafb;color:#111827;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:white;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="margin-bottom:24px;"><span style="font-size:20px;font-weight:700;color:#0074c5">Klasly</span></div>
      ${html}
      <p style="margin-top:32px;font-size:12px;color:#6b7280;">Manage your bookings at app.klasly.app</p>
    </div>
  </div>
</body>
</html>`;
      await sendEmail({
        to: owner.email,
        subject,
        html: wrapped,
        studioId: studio.id,
        templateName: "past_due_grace_warning",
      });
    }
    updated++;
  }

    try {
      if (cronLogId) {
        const adminDb = createAdminClient();
        await adminDb
          .from("cron_logs")
          .update({
            status: "success",
            affected_count: updated,
            details: { studios_processed: studios.length },
            completed_at: new Date().toISOString(),
          })
          .eq("id", cronLogId);
      }
    } catch {
      // ログ記録失敗はスキップ
    }

  return NextResponse.json({ processed: studios.length, updated });
  } catch (error) {
    try {
      if (cronLogId) {
        const adminDb = createAdminClient();
        await adminDb
          .from("cron_logs")
          .update({
            status: "failure",
            error_message: error instanceof Error ? error.message : "Unknown error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", cronLogId);
      }
    } catch {
      // ログ記録失敗はスキップ
    }
    throw error;
  }
}
