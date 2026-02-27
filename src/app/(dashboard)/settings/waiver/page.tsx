import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import WaiverSettingsClient from "@/components/settings/waiver-settings-client";

export default async function WaiverSettingsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) redirect("/login");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || profile.role !== "owner") redirect("/");

  const { data: template } = await supabase
    .from("waiver_templates")
    .select("id, title, content")
    .eq("studio_id", profile.studio_id)
    .single();

  const { data: members } = await supabase
    .from("members")
    .select("id, waiver_signed, waiver_signed_at, profiles(full_name, email)")
    .eq("studio_id", profile.studio_id)
    .eq("status", "active");

  const signedCount = (members || []).filter((m) => m.waiver_signed).length;
  const totalCount = members?.length ?? 0;
  const unsignedMembers = (members || []).filter((m) => !m.waiver_signed);

  return (
    <div>
      <Link
        href="/settings"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to Settings
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">Waiver Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage your liability waiver template and track signing status
      </p>

      <WaiverSettingsClient
        template={template}
        signedCount={signedCount}
        totalCount={totalCount}
        unsignedMembers={unsignedMembers.map((m) => ({
          id: m.id,
          fullName: (m.profiles as { full_name?: string })?.full_name || "—",
          email: (m.profiles as { email?: string })?.email || "—",
        }))}
      />
    </div>
  );
}
