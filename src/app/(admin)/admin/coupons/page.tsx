import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminCouponsPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Coupons</h1>
      <p className="mt-2 text-slate-400">Coupon management (Step 3)</p>
    </div>
  );
}
