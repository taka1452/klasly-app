import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import PaymentsTable from "@/components/payments/payments-table";
import ExportCsvButton from "@/components/ui/export-csv-button";
import ContextHelpLink from "@/components/help/context-help-link";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) redirect("/login");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || !["owner", "manager"].includes(profile.role)) redirect("/dashboard");

  // マネージャー権限チェック（can_view_payments）
  const permCheck = await checkManagerPermission("can_view_payments");
  if (!permCheck.allowed) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const typeFilter = params.type ?? "all";
  const statusFilter = params.status ?? "all";

  const { data: payments } = await supabase
    .from("payments")
    .select(`
      id,
      amount,
      currency,
      type,
      status,
      payment_type,
      paid_at,
      created_at,
      member_id,
      members (
        id,
        profiles (full_name)
      )
    `)
    .eq("studio_id", profile.studio_id)
    .order("created_at", { ascending: false });

  const filtered = (payments ?? []).filter((p) => {
    if (typeFilter !== "all") {
      const pt = p.payment_type ?? p.type;
      if (typeFilter === "subscription" && pt !== "subscription") return false;
      if (typeFilter === "class_pack" && !["pack_5", "pack_10"].includes(pt ?? "")) return false;
      if (typeFilter === "drop_in" && pt !== "drop_in") return false;
      if (typeFilter === "monthly" && pt !== "monthly") return false;
    }
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTotal = filtered
    .filter((p) => p.status === "paid" && p.paid_at && new Date(p.paid_at) >= startOfMonth)
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">View payment history and revenue</p>
          <ContextHelpLink href="/help/payments/view-payment-history" />
        </div>
        <ExportCsvButton
          url={`/api/export/payments?from=${thirtyDaysAgo}&to=${today}`}
          filename={`payments-${thirtyDaysAgo}-to-${today}.csv`}
        />
      </div>

      <div className="mt-6 card">
        <h2 className="text-lg font-semibold text-gray-900">
          This month&apos;s revenue
        </h2>
        <p className="mt-1 text-2xl font-bold text-brand-600">
          {formatCurrency(monthTotal)}
        </p>
      </div>

      <PaymentsTable
        payments={filtered}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
      />
    </div>
  );
}
