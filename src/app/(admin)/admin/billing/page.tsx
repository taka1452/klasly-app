import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminBillingPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Billing</h1>
      <p className="mt-2 text-slate-400">Billing management (Step 3)</p>
    </div>
  );
}
