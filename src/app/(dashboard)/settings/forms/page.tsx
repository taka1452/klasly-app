import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import FormsManagerClient from "@/components/settings/forms-manager-client";

export const metadata: Metadata = {
  title: "Forms & documents — Klasly",
};

export default async function FormsSettingsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) redirect("/login");

  const perm = await checkManagerPermission();
  if (!perm.allowed) redirect("/dashboard");
  if (perm.role === "manager" && !perm.permissions?.can_manage_settings) {
    redirect("/dashboard");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();
  if (!profile?.studio_id) redirect("/onboarding");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Forms &amp; documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Build waivers, applications, contracts, medical intake forms, or any
          custom form. Share the public link on your website; submissions show
          up here.
        </p>
      </div>

      <FormsManagerClient />
    </div>
  );
}
