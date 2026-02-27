import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Grace 期間終了 → Canceled に遷移、Stripe サブスクを即時キャンセル
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

  const now = new Date().toISOString();

  const { data: studios } = await supabase
    .from("studios")
    .select("id, name, stripe_subscription_id")
    .eq("plan_status", "grace")
    .not("grace_period_ends_at", "is", null)
    .lt("grace_period_ends_at", now);

  if (!studios?.length) {
    return NextResponse.json({ processed: 0 });
  }

  let updated = 0;
  for (const studio of studios) {
    if (studio.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(studio.stripe_subscription_id);
      } catch (err) {
        console.error("[grace-check] Stripe cancel failed:", err);
      }
    }

    await supabase
      .from("studios")
      .update({
        plan_status: "canceled",
        stripe_subscription_id: null,
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
      const subject = "Your Klasly subscription has been suspended";
      const html = `
        <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Subscription Suspended</h2>
        <p style="margin:0 0 8px;font-size:15px;">Hi ${owner.full_name || "Studio Owner"},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
          Your Klasly subscription for <strong>${studio.name || "your studio"}</strong> has been suspended due to non-payment.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
          You can reactivate your subscription anytime in Settings → Billing.
        </p>
        <p style="margin:0;font-size:14px;">We hope to see you again.</p>
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
      await sendEmail({ to: owner.email, subject, html: wrapped });
    }
    updated++;
  }

  return NextResponse.json({ processed: studios.length, updated });
}
