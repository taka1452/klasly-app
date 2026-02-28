import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import AdminShell from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userEmail = user.email ?? "admin";

  return (
    <AdminShell userEmail={userEmail}>
      {children}
    </AdminShell>
  );
}
