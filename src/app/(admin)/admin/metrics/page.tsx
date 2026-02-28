import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import Link from "next/link";

export default async function AdminMetricsPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalStudios },
    { data: activeStudios },
    { count: webhooks24h },
    { count: webhooks7d },
    { count: webhooksFailed7d },
    { count: cronRuns7d },
    { count: cronFailed7d },
    { count: emailsSent7d },
    { count: emailsFailed7d },
  ] = await Promise.all([
    supabase.from("studios").select("id", { count: "exact", head: true }),
    supabase.from("studios").select("id, subscription_period").in("plan_status", ["trialing", "active"]),
    supabase.from("webhook_logs").select("id", { count: "exact", head: true }).gte("created_at", oneDayAgo).eq("status", "success"),
    supabase.from("webhook_logs").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo).eq("status", "success"),
    supabase.from("webhook_logs").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo).eq("status", "failure"),
    supabase.from("cron_logs").select("id", { count: "exact", head: true }).gte("started_at", sevenDaysAgo).eq("status", "success"),
    supabase.from("cron_logs").select("id", { count: "exact", head: true }).gte("started_at", sevenDaysAgo).eq("status", "failure"),
    supabase.from("email_logs").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo).eq("status", "sent"),
    supabase.from("email_logs").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo).eq("status", "failed"),
  ]);

  const monthlyActive = (activeStudios || []).filter((s) => (s as { subscription_period?: string }).subscription_period === "monthly").length;
  const yearlyActive = (activeStudios || []).filter((s) => (s as { subscription_period?: string }).subscription_period === "yearly").length;
  const MRR = monthlyActive * 19 + yearlyActive * (190 / 12);
  const ARR = MRR * 12;

  const { data: webhookByType } = await supabase
    .from("webhook_logs")
    .select("event_type")
    .gte("created_at", sevenDaysAgo)
    .eq("status", "success");

  const eventCounts: Record<string, number> = {};
  (webhookByType || []).forEach((r) => {
    eventCounts[r.event_type] = (eventCounts[r.event_type] || 0) + 1;
  });

  const { data: recentWebhooks } = await supabase
    .from("webhook_logs")
    .select("id, event_type, event_id, studio_id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: recentCrons } = await supabase
    .from("cron_logs")
    .select("id, job_name, status, affected_count, started_at, completed_at")
    .order("started_at", { ascending: false })
    .limit(10);

  const formatDate = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Metrics</h1>
      <p className="text-slate-400">System health and activity overview</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Total studios</p>
          <p className="mt-1 text-2xl font-bold text-white">{totalStudios ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">MRR</p>
          <p className="mt-1 text-2xl font-bold text-white">${MRR.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">ARR</p>
          <p className="mt-1 text-2xl font-bold text-white">${ARR.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Active (trialing + active)</p>
          <p className="mt-1 text-2xl font-bold text-white">{(activeStudios || []).length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Webhooks (24h success)</p>
          <p className="mt-1 text-xl font-bold text-white">{webhooks24h ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Webhooks (7d success / failed)</p>
          <p className="mt-1 text-xl font-bold text-white">{webhooks7d ?? 0} / <span className="text-red-400">{webhooksFailed7d ?? 0}</span></p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Cron (7d success / failed)</p>
          <p className="mt-1 text-xl font-bold text-white">{cronRuns7d ?? 0} / <span className="text-red-400">{cronFailed7d ?? 0}</span></p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Emails (7d sent / failed)</p>
          <p className="mt-1 text-xl font-bold text-white">{emailsSent7d ?? 0} / <span className="text-red-400">{emailsFailed7d ?? 0}</span></p>
        </div>
      </div>

      {Object.keys(eventCounts).length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h2 className="text-sm font-medium text-slate-300">Webhook events by type (7d)</h2>
          <ul className="mt-2 flex flex-wrap gap-3 text-sm">
            {Object.entries(eventCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <li key={type} className="rounded bg-slate-700 px-2 py-1 text-slate-200">
                  {type}: {count}
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h2 className="text-sm font-medium text-slate-300">Recent webhooks</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600 text-left text-slate-400">
                  <th className="p-2">Time</th>
                  <th className="p-2">Event</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(recentWebhooks || []).length === 0 ? (
                  <tr><td colSpan={3} className="p-2 text-slate-500">No webhooks</td></tr>
                ) : (
                  (recentWebhooks || []).map((w) => (
                    <tr key={w.id} className="border-b border-slate-700">
                      <td className="p-2 text-slate-300">{formatDate(w.created_at)}</td>
                      <td className="p-2 text-white">{w.event_type}</td>
                      <td className="p-2">
                        <span className={w.status === "success" ? "text-green-400" : "text-red-400"}>{w.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Link href="/admin/logs?tab=webhooks" className="mt-2 inline-block text-sm text-indigo-400 hover:underline">View all →</Link>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <h2 className="text-sm font-medium text-slate-300">Recent cron runs</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-600 text-left text-slate-400">
                  <th className="p-2">Time</th>
                  <th className="p-2">Job</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {(recentCrons || []).length === 0 ? (
                  <tr><td colSpan={4} className="p-2 text-slate-500">No cron runs</td></tr>
                ) : (
                  (recentCrons || []).map((c) => (
                    <tr key={c.id} className="border-b border-slate-700">
                      <td className="p-2 text-slate-300">{formatDate(c.started_at)}</td>
                      <td className="p-2 text-white">{c.job_name}</td>
                      <td className="p-2">
                        <span className={c.status === "success" ? "text-green-400" : "text-red-400"}>{c.status}</span>
                      </td>
                      <td className="p-2 text-slate-300">{c.affected_count ?? 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Link href="/admin/logs?tab=cron" className="mt-2 inline-block text-sm text-indigo-400 hover:underline">View all →</Link>
        </div>
      </div>
    </div>
  );
}
