import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import SettingsContent from "@/components/settings/settings-content";

export const metadata: Metadata = {
  title: "Settings - Klasly",
};

export default async function SettingsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || profile?.role !== "owner") {
    redirect("/");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage your account and data
      </p>

      <SettingsContent
        fullName={profile.full_name || user.email || "—"}
        email={profile.email || user.email || "—"}
      />
    </div>
  );
}
