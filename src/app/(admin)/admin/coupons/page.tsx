import { requireAdmin } from "@/lib/admin/auth";
import AdminCouponsPageClient from "@/components/admin/admin-coupons-client";

export default async function AdminCouponsPage() {
  await requireAdmin();
  return <AdminCouponsPageClient />;
}
