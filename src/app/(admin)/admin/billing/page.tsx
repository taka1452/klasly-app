import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import Link from "next/link";

const STRIPE_DASHBOARD = "https://dashboard.stripe.com";

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Billing</h1>
      <p className="text-slate-400">Revenue overview and Stripe dashboard</p>

      <div className="flex flex-wrap items-center gap-4">
        <a
          href={STRIPE_DASHBOARD}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-indigo-500 bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-500/30"
        >
          Open Stripe Dashboard →
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">MRR</p>
          <p className="mt-1 text-2xl font-bold text-white">${MRR.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">ARR</p>
          <p className="mt-1 text-2xl font-bold text-white">${ARR.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Revenue this month</p>
          <p className="mt-1 text-2xl font-bold text-white">${revenueThisMonth.toFixed(0)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm text-slate-400">Past due studios</p>
          <p className={`mt-1 text-2xl font-bold ${(pastDueCount ?? 0) > 0 ? "text-red-400" : "text-white"}`}>
            {pastDueCount ?? 0}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <h2 className="text-sm font-medium text-slate-300">Recent payments</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-600 text-left text-slate-400">
                <th className="p-2">Date</th>
                <th className="p-2">Studio</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Type</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(recentPayments || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-slate-500">
                    No payments
                  </td>
                </tr>
              ) : (
                (recentPayments || []).map((p) => (
                  <tr key={p.id} className="border-b border-slate-700">
                    <td className="p-2 text-white">
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleDateString("en-US")
                        : new Date(p.created_at).toLocaleDateString("en-US")}
                    </td>
                    <td className="p-2">
                      <Link
                        href={`/admin/studios/${p.studio_id}`}
                        className="text-indigo-400 hover:underline"
                      >
                        {nameById[p.studio_id] ?? p.studio_id}
                      </Link>
                    </td>
                    <td className="p-2 text-white">${((p.amount ?? 0) / 100).toFixed(2)}</td>
                    <td className="p-2 text-slate-300">{p.type ?? "—"}</td>
                    <td className="p-2">
                      <span
                        className={
                          p.status === "paid"
                            ? "rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-300"
                            : "rounded-full bg-slate-600 px-2 py-0.5 text-xs text-slate-300"
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
