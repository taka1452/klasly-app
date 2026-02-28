import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminSupportPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Support</h1>
      <p className="mt-2 text-slate-400">Support tickets (Step 5)</p>
    </div>
  );
}
