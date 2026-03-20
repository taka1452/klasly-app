import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import WidgetSettingsClient from "@/components/settings/widget-settings-client";

export const metadata: Metadata = {
  title: "Widget Settings - Klasly",
};

export default async function WidgetSettingsPage() {
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
        serviceRoleKey,
      )
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || (profile?.role !== "owner" && profile?.role !== "manager")) {
    redirect("/");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Website Widget</h1>
      <p className="mt-1 text-sm text-gray-500">
        Embed your class schedule on your website so visitors can browse and
        book classes.
      </p>

      <div className="mt-6">
        <WidgetSettingsClient studioId={profile.studio_id} />
      </div>
    </div>
  );
}
