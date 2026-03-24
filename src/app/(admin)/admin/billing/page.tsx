import { createAdminClient } from "@/lib/admin/supabase";
import AdminBillingClient from "@/components/admin/admin-billing-client";

export default async function AdminBillingPage() {
  const supabase = createAdminClient();

  // デモスタジオのIDを取得して除外に使う
  const { data: demoStudios } = await supabase
    .from("studios")
    .select("id")
    .eq("is_demo", true);
  const demoIds = new Set((demoStudios || []).map((s) => s.id));

  const { data: activeStudios } = await supabase
    .from("studios")
    .select("id, plan_status, subscription_period")
    .in("plan_status", ["trialing", "active"])
    .eq("is_demo", false);

  const monthlyActive = (activeStudios || []).filter(
    (s) => (s as { subscription_period?: string }).subscription_period === "monthly"
  ).length;
  const yearlyActive = (activeStudios || []).filter(
    (s) => (s as { subscription_period?: string }).subscription_period === "yearly"
  ).length;

  const MRR = monthlyActive * 19 + yearlyActive * (190 / 12);
  const ARR = MRR * 12;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: paymentsThisMonth } = await supabase
    .from("payments")
    .select("id, amount, status, studio_id")
    .gte("created_at", startOfMonth)
    .eq("status", "paid");

  const realPaymentsThisMonth = (paymentsThisMonth || []).filter(
    (p) => !p.studio_id || !demoIds.has(p.studio_id)
  );
  const revenueThisMonthCents = realPaymentsThisMonth.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const revenueThisMonth = revenueThisMonthCents / 100;

  const { count: pastDueCount } = await supabase
    .from("studios")
    .select("id", { count: "exact", head: true })
    .eq("plan_status", "past_due")
    .eq("is_demo", false);

  const { data: recentPaymentsRaw } = await supabase
    .from("payments")
    .select("id, studio_id, amount, type, status, paid_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  // デモスタジオの支払いを除外し、上位20件に絞る
  const recentPayments = (recentPaymentsRaw || [])
    .filter((p) => !p.studio_id || !demoIds.has(p.studio_id))
    .slice(0, 20);

  const studioIds = Array.from(new Set(recentPayments.map((p) => p.studio_id).filter(Boolean))) as string[];
  const { data: studiosMap } =
    studioIds.length > 0
      ? await supabase.from("studios").select("id, name").in("id", studioIds)
      : { data: [] };
  const nameById = (studiosMap || []).reduce(
    (acc, s) => {
      acc[s.id] = s.name;
      return acc;
    },
    {} as Record<string, string>
  );

  return (
    <AdminBillingClient
      MRR={MRR}
      ARR={ARR}
      revenueThisMonth={revenueThisMonth}
      pastDueCount={pastDueCount ?? 0}
      recentPayments={recentPayments ?? []}
      nameById={nameById}
    />
  );
}
