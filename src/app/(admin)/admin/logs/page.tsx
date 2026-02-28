import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminLogsPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Logs</h1>
      <p className="mt-2 text-slate-400">Webhooks, Cron, Emails (Step 4)</p>
    </div>
  );
}
