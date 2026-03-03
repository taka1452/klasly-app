import { requireAdmin } from "@/lib/admin/auth";
import AdminPlatformSettings from "@/components/admin/admin-platform-settings";

export default async function AdminSettingsPage() {
  await requireAdmin();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Configure platform-wide settings (e.g. Connect platform fee).
      </p>
      <AdminPlatformSettings className="mt-6" />
    </div>
  );
}
