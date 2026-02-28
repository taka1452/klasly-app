import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import AdminMetricsContent from "@/components/admin/admin-metrics-content";

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

  return (
    <AdminMetricsContent
      totalStudios={totalStudios ?? 0}
      activeCount={(activeStudios || []).length}
      MRR={MRR}
      ARR={ARR}
      webhooks24h={webhooks24h ?? 0}
      webhooks7d={webhooks7d ?? 0}
      webhooksFailed7d={webhooksFailed7d ?? 0}
      cronRuns7d={cronRuns7d ?? 0}
      cronFailed7d={cronFailed7d ?? 0}
      emailsSent7d={emailsSent7d ?? 0}
      emailsFailed7d={emailsFailed7d ?? 0}
      eventCounts={eventCounts}
      recentWebhooks={recentWebhooks || []}
      recentCrons={recentCrons || []}
    />
  );
}
