import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import Link from "next/link";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { count: totalStudios } = await supabase
    .from("studios")
    .select("id", { count: "exact", head: true });

  const { count: activeCount } = await supabase
    .from("studios")
    .select("id", { count: "exact", head: true })
    .in("plan_status", ["trialing", "active"]);

  const { data: activeStudios } = await supabase
    .from("studios")
    .select("id, plan_status, subscription_period")
    .in("plan_status", ["trialing", "active"]);

  const monthlyActive = (activeStudios || []).filter(
    (s) => (s as { subscription_period?: string }).subscription_period === "monthly"
  ).length;
  const yearlyActive = (activeStudios || []).filter(
    (s) => (s as { subscription_period?: string }).subscription_period === "yearly"
  ).length;

  const MRR = monthlyActive * 19 + yearlyActive * (190 / 12);

  const { count: pastDueCount } = await supabase
    .from("studios")
    .select("id", { count: "exact", head: true })
    .eq("plan_status", "past_due");

  const { count: trialingCount } = await supabase
    .from("studios")
    .select("id", { count: "exact", head: true })
    .eq("plan_status", "trialing");

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { count: trialsEnding7d } = await supabase
    .from("studios")
    .select("id", { count: "exact", head: true })
    .eq("plan_status", "trialing")
    .lte("trial_ends_at", in7Days);

  const ARR = MRR * 12;

  const { count: activeCouponsCount } = await supabase
    .from("coupons")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  const { data: alertsPastDue } = await supabase
    .from("studios")
    .select("id, name")
    .eq("plan_status", "past_due");

  const { data: alertsGrace } = await supabase
    .from("studios")
    .select("id, name, grace_period_ends_at")
    .eq("plan_status", "grace");

  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: alertsTrialEnding } = await supabase
    .from("studios")
    .select("id, name, trial_ends_at")
    .eq("plan_status", "trialing")
    .lte("trial_ends_at", in3Days);

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentlyCanceled } = await supabase
    .from("studios")
    .select("id, name, created_at")
    .eq("plan_status", "canceled")
    .gte("created_at", sevenDaysAgo);

  const { data: recentStudios } = await supabase
    .from("studios")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: recentWebhooks } = await supabase
    .from("webhook_logs")
    .select("id, event_type, studio_id, status, created_at, payload")
    .order("created_at", { ascending: false })
    .limit(10);

  const studioIds = (recentWebhooks || [])
    .map((w) => w.studio_id)
    .filter(Boolean) as string[];
  const { data: webhookStudios } =
    studioIds.length > 0
      ? await supabase.from("studios").select("id, name").in("id", studioIds)
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
    alerts.push({
      type: "grace",
      studioName: s.name,
      studioId: s.id,
      extra: `${days} days`,
    });
  });
  (alertsTrialEnding || []).forEach((s) => {
    const endsAt = (s as { trial_ends_at?: string }).trial_ends_at;
    const days = endsAt
      ? Math.ceil((new Date(endsAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    alerts.push({
      type: "trial",
      studioName: s.name,
      studioId: s.id,
      extra: `${days} days left`,
    });
  });
  (recentlyCanceled || []).forEach((s) =>
    alerts.push({ type: "canceled", studioName: s.name, studioId: s.id })
  );

  type ActivityItem = { at: string; icon: string; text: string };
  const activities: ActivityItem[] = [];
  (recentStudios || []).forEach((s) => {
    activities.push({
      at: s.created_at,
      icon: "🆕",
      text: `${s.name} signed up`,
    });
  });
  (recentWebhooks || []).forEach((w) => {
    const name = studioNameMap[w.studio_id ?? ""] ?? "Studio";
    if (w.event_type === "checkout.session.completed" || w.event_type?.includes("invoice.paid")) {
      const payload = w.payload as { data?: { object?: { amount_paid?: number } } } | null;
      const amount = payload?.data?.object?.amount_paid ?? 0;
      const dollars = (amount / 100).toFixed(0);
      activities.push({ at: w.created_at, icon: "💳", text: `${name} paid $${dollars}` });
    } else if (w.event_type?.includes("payment_failed")) {
      activities.push({ at: w.created_at, icon: "❌", text: `${name} payment failed` });
    } else if (w.event_type?.includes("subscription.deleted") || w.event_type?.includes("customer.subscription.deleted")) {
      activities.push({ at: w.created_at, icon: "🚫", text: `${name} subscription canceled` });
    }
  });
  activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const topActivities = activities.slice(0, 10);

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Total Studios</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalStudios ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Active</p>
          <p className="mt-1 text-2xl font-bold text-white">{activeCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">MRR</p>
          <p className="mt-1 text-2xl font-bold text-white">${MRR.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Past Due</p>
          <p className={`mt-1 text-2xl font-bold ${(pastDueCount ?? 0) > 0 ? "text-red-400" : "text-white"}`}>
            {pastDueCount ?? 0}
          </p>
        </div>
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Trialing</p>
          <p className="mt-1 text-xl font-bold text-white">{trialingCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Trials Ending ≤7d</p>
          <p className="mt-1 text-xl font-bold text-white">{trialsEnding7d ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">ARR</p>
          <p className="mt-1 text-xl font-bold text-white">${ARR.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Active Coupons</p>
          <p className="mt-1 text-xl font-bold text-white">{activeCouponsCount ?? 0}</p>
        </div>
      </div>

      {/* Alerts */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <h2 className="text-sm font-medium text-slate-300">Alerts</h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-green-400">✓ All clear – no alerts</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alerts.map((a) => (
              <li key={`${a.studioId}-${a.type}`}>
                <Link
                  href={`/admin/studios/${a.studioId}`}
                  className={`block rounded px-3 py-2 text-sm ${
                    a.type === "past_due" || a.type === "grace"
                      ? "bg-red-900/50 text-red-200 hover:bg-red-900/70"
                      : a.type === "trial"
                        ? "bg-yellow-900/50 text-yellow-200 hover:bg-yellow-900/70"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  {a.type === "past_due" && `⚠ Payment failed: ${a.studioName}`}
                  {a.type === "grace" && `⚠ Grace period: ${a.studioName} – auto-cancel in ${a.extra}`}
                  {a.type === "trial" && `Trial ending soon: ${a.studioName} – ${a.extra}`}
                  {a.type === "canceled" && `Recently canceled: ${a.studioName}`}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent activity */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
        <h2 className="text-sm font-medium text-slate-300">Recent Activity</h2>
        <ul className="mt-3 space-y-2">
          {topActivities.length === 0 ? (
            <li className="text-sm text-slate-500">No recent activity</li>
          ) : (
            topActivities.map((a, i) => (
              <li key={`${a.at}-${i}`} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="text-slate-500">
                  {formatDate(a.at)} {formatTime(a.at)}
                </span>
                <span>{a.icon}</span>
                <span>{a.text}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
