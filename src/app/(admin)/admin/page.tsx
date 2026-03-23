import { createAdminClient } from "@/lib/admin/supabase";
import { stripe } from "@/lib/stripe/server";
import AdminDashboardClient from "@/components/admin/admin-dashboard-client";

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();
  const now = new Date();

  // ── KPI: スタジオ集計（is_demo=false のみ） ──
  const { count: totalStudios } = await supabase
    .from("studios")
    .select("id", { count: "exact", head: true })
    .eq("is_demo", false);

  const { count: activeCount } = await supabase
    .from("studios")
    .select("id", { count: "exact", head: true })
    .in("plan_status", ["trialing", "active"])
    .eq("is_demo", false);

  const { data: activeStudios } = await supabase
    .from("studios")
    .select("id, plan_status, subscription_period")
    .in("plan_status", ["trialing", "active"])
    .eq("is_demo", false);

  const monthlyActive = (activeStudios || []).filter(
    (s) => s.subscription_period === "monthly"
  ).length;
  const yearlyActive = (activeStudios || []).filter(
    (s) => s.subscription_period === "yearly"
  ).length;

  // ── 売上実体: Stripe API から直接取得 ──
  let revenueThisMonth = 0;
  let revenueLastMonth = 0;
  try {
    // 今月の売上
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const charges = await stripe.charges.list({
      created: { gte: Math.floor(thisMonthStart.getTime() / 1000) },
      limit: 100,
    });
    revenueThisMonth = charges.data
      .filter((c) => c.paid && !c.refunded)
      .reduce((sum, c) => sum + c.amount, 0);

    // 先月の売上
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastCharges = await stripe.charges.list({
      created: {
        gte: Math.floor(lastMonthStart.getTime() / 1000),
        lt: Math.floor(lastMonthEnd.getTime() / 1000),
      },
      limit: 100,
    });
    revenueLastMonth = lastCharges.data
      .filter((c) => c.paid && !c.refunded)
      .reduce((sum, c) => sum + c.amount, 0);
  } catch {
    // Stripe API failure should not break dashboard
  }

  // MRR: 実サブスクリプション価格ベース
  const monthlyPrice = Number(process.env.PLAN_MONTHLY_PRICE ?? 19);
  const yearlyPrice = Number(process.env.PLAN_YEARLY_PRICE ?? 190);
  const MRR = monthlyActive * monthlyPrice + yearlyActive * (yearlyPrice / 12);
  const ARR = MRR * 12;

  const { count: pastDueCount } = await supabase
    .from("studios")
    .select("id", { count: "exact", head: true })
    .eq("plan_status", "past_due")
    .eq("is_demo", false);

  const { count: trialingCount } = await supabase
    .from("studios")
    .select("id", { count: "exact", head: true })
    .eq("plan_status", "trialing")
    .eq("is_demo", false);

  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { count: trialsEnding7d } = await supabase
    .from("studios")
    .select("id", { count: "exact", head: true })
    .eq("plan_status", "trialing")
    .lte("trial_ends_at", in7Days)
    .eq("is_demo", false);

  // ── 新規登録数（今日 / 今週） ──
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const { count: newSignupsToday } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner")
    .gte("created_at", todayStart);

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: newSignupsWeek } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner")
    .gte("created_at", sevenDaysAgo);

  // ── アラート ──
  const { data: alertsPastDue } = await supabase
    .from("studios")
    .select("id, name")
    .eq("plan_status", "past_due")
    .eq("is_demo", false);

  const { data: alertsGrace } = await supabase
    .from("studios")
    .select("id, name, grace_period_ends_at")
    .eq("plan_status", "grace")
    .eq("is_demo", false);

  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: alertsTrialEnding } = await supabase
    .from("studios")
    .select("id, name, trial_ends_at")
    .eq("plan_status", "trialing")
    .lte("trial_ends_at", in3Days)
    .eq("is_demo", false);

  const { data: recentlyCanceled } = await supabase
    .from("studios")
    .select("id, name, current_period_end")
    .eq("plan_status", "canceled")
    .gte("current_period_end", sevenDaysAgo)
    .eq("is_demo", false);

  // Stale studios: 7日以上経過でクラス未作成
  const staleThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: oldStudios } = await supabase
    .from("studios")
    .select("id, name, created_at")
    .eq("is_demo", false)
    .in("plan_status", ["trialing", "active"])
    .lte("created_at", staleThreshold);

  const staleStudios: { id: string; name: string; daysSinceCreated: number }[] = [];
  if (oldStudios && oldStudios.length > 0) {
    const oldIds = oldStudios.map((s) => s.id);
    const { data: studiosWithClasses } = await supabase
      .from("classes")
      .select("studio_id")
      .in("studio_id", oldIds);
    const hasClassSet = new Set((studiosWithClasses || []).map((c) => c.studio_id));
    for (const s of oldStudios) {
      if (!hasClassSet.has(s.id)) {
        const days = Math.floor((now.getTime() - new Date(s.created_at).getTime()) / (24 * 60 * 60 * 1000));
        staleStudios.push({ id: s.id, name: s.name, daysSinceCreated: days });
      }
    }
  }

  // ── 最近のアクティビティ ──
  const { data: recentStudios } = await supabase
    .from("studios")
    .select("id, name, created_at")
    .eq("is_demo", false)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: recentWebhooks } = await supabase
    .from("webhook_logs")
    .select("id, event_type, studio_id, status, created_at, payload")
    .order("created_at", { ascending: false })
    .limit(10);

  const whStudioIds = (recentWebhooks || [])
    .map((w) => w.studio_id)
    .filter(Boolean) as string[];
  const { data: webhookStudios } =
    whStudioIds.length > 0
      ? await supabase.from("studios").select("id, name").in("id", whStudioIds)
      : { data: [] };
  const studioNameMap = (webhookStudios || []).reduce(
    (acc, s) => {
      acc[s.id] = s.name;
      return acc;
    },
    {} as Record<string, string>
  );

  const alerts: { type: string; studioName: string; studioId: string; extra?: string }[] = [];
  (alertsPastDue || []).forEach((s) =>
    alerts.push({ type: "past_due", studioName: s.name, studioId: s.id })
  );
  (alertsGrace || []).forEach((s) => {
    const endsAt = (s as { grace_period_ends_at?: string }).grace_period_ends_at;
    const days = endsAt
      ? Math.ceil((new Date(endsAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    alerts.push({ type: "grace", studioName: s.name, studioId: s.id, extra: `${days} days` });
  });
  (alertsTrialEnding || []).forEach((s) => {
    const endsAt = (s as { trial_ends_at?: string }).trial_ends_at;
    const days = endsAt
      ? Math.ceil((new Date(endsAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    alerts.push({ type: "trial", studioName: s.name, studioId: s.id, extra: `${days} days left` });
  });
  (recentlyCanceled || []).forEach((s) =>
    alerts.push({ type: "canceled", studioName: s.name, studioId: s.id })
  );
  staleStudios.forEach((s) =>
    alerts.push({ type: "stale", studioName: s.name, studioId: s.id, extra: `${s.daysSinceCreated}` })
  );

  type ActivityItem = { at: string; type: "signed_up" | "paid" | "failed" | "canceled"; textKey: string; textParams?: Record<string, string | number> };
  const activities: ActivityItem[] = [];
  (recentStudios || []).forEach((s) => {
    activities.push({ at: s.created_at, type: "signed_up", textKey: "dashboard.signedUp", textParams: { name: s.name } });
  });
  (recentWebhooks || []).forEach((w) => {
    const name = studioNameMap[w.studio_id ?? ""] ?? "Studio";
    if (w.event_type === "checkout.session.completed" || w.event_type?.includes("invoice.paid")) {
      const payload = w.payload as { data?: { object?: { amount_paid?: number } } } | null;
      const amount = payload?.data?.object?.amount_paid ?? 0;
      const dollars = (amount / 100).toFixed(0);
      activities.push({ at: w.created_at, type: "paid", textKey: "dashboard.paid", textParams: { name, amount: dollars } });
    } else if (w.event_type?.includes("payment_failed")) {
      activities.push({ at: w.created_at, type: "failed", textKey: "dashboard.paymentFailed", textParams: { name } });
    } else if (w.event_type?.includes("subscription.deleted") || w.event_type?.includes("customer.subscription.deleted")) {
      activities.push({ at: w.created_at, type: "canceled", textKey: "dashboard.subscriptionCanceled", textParams: { name } });
    }
  });
  activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const topActivities = activities.slice(0, 10);

  return (
    <AdminDashboardClient
      totalStudios={totalStudios ?? 0}
      activeCount={activeCount ?? 0}
      MRR={MRR}
      ARR={ARR}
      pastDueCount={pastDueCount ?? 0}
      trialingCount={trialingCount ?? 0}
      trialsEnding7d={trialsEnding7d ?? 0}
      newSignupsToday={newSignupsToday ?? 0}
      newSignupsWeek={newSignupsWeek ?? 0}
      revenueThisMonth={revenueThisMonth}
      revenueLastMonth={revenueLastMonth}
      alerts={alerts}
      activities={topActivities}
    />
  );
}
