import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import AdminBillingClient from "@/components/admin/admin-billing-client";

export default async function AdminBillingPage() {
  await requireAdmin();
  const supabase = createAdminClient();

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
  const ARR = MRR * 12;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: paymentsThisMonth } = await supabase
    .from("payments")
    .select("id, amount, status")
    .gte("created_at", startOfMonth)
    .eq("status", "paid");

  const revenueThisMonthCents = (paymentsThisMonth || []).reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const revenueThisMonth = revenueThisMonthCents / 100;

  const { count: pastDueCount } = await supabase
    .from("studios")
    .select("id", { count: "exact", head: true })
    .eq("plan_status", "past_due");

  const { data: recentPayments } = await supabase
    .from("payments")
    .select("id, studio_id, amount, type, status, paid_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const studioIds = Array.from(new Set((recentPayments || []).map((p) => p.studio_id).filter(Boolean))) as string[];
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
