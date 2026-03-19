import { createAdminClient } from "@/lib/admin/supabase";
import AdminStudiosList from "@/components/admin/admin-studios-list";

export default async function AdminStudiosPage() {
  const supabase = createAdminClient();

  const statuses = ["all", "trialing", "active", "past_due", "grace", "canceled"] as const;
  const counts: Record<string, number> = {};

  // デモスタジオを除外した件数を集計（デモ表示時は別途クライアント側で再取得）
  for (const s of statuses) {
    let q = supabase.from("studios").select("id", { count: "exact", head: true }).eq("is_demo", false);
    if (s !== "all") q = q.eq("plan_status", s);
    const { count } = await q;
    counts[s] = count ?? 0;
  }

  return (
    <div className="space-y-6">
      <AdminStudiosList statusCounts={counts} />
    </div>
  );
}
