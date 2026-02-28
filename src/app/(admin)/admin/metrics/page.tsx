import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminMetricsPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Metrics</h1>
      <p className="mt-2 text-slate-400">Metrics (Step 4)</p>
    </div>
  );
}
