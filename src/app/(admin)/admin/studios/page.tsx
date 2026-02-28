import { requireAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/admin/supabase";
import AdminStudiosList from "@/components/admin/admin-studios-list";

export default async function AdminStudiosPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const statuses = ["all", "trialing", "active", "past_due", "grace", "canceled"] as const;
  const counts: Record<string, number> = {};

  for (const s of statuses) {
    let q = supabase.from("studios").select("id", { count: "exact", head: true });
    if (s !== "all") q = q.eq("plan_status", s);
    const { count } = await q;
    counts[s] = count ?? 0;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Studios</h1>
      <AdminStudiosList statusCounts={counts} />
    </div>
  );
}
