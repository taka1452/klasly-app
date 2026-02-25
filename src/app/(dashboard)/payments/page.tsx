import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PaymentsTable from "@/components/payments/payments-table";

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

  if (!profile?.studio_id || profile.role !== "owner") redirect("/");

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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
      <p className="mt-1 text-sm text-gray-500">
        View payment history and revenue
      </p>

      <div className="mt-6 card">
        <h2 className="text-lg font-semibold text-gray-900">
          This month&apos;s revenue
        </h2>
        <p className="mt-1 text-2xl font-bold text-brand-600">
          ${(monthTotal / 100).toFixed(2)}
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
