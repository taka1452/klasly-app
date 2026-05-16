import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import WaiverSettingsClient from "@/components/settings/waiver-settings-client";
import HelpTip from "@/components/ui/help-tip";
import ContextHelpLink from "@/components/help/context-help-link";

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

  if (!profile?.studio_id || (profile.role !== "owner" && profile.role !== "manager")) redirect("/");

  const { data: studio } = await supabase
    .from("studios")
    .select("name")
    .eq("id", profile.studio_id)
    .single();

  const { data: template } = await supabase
    .from("waiver_templates")
    .select("id, title, content")
    .eq("studio_id", profile.studio_id)
    .maybeSingle();

  // All active waiver templates for the per-template re-sign picker.
  // Studios typically have 1 main template plus a few per-class waivers
  // (e.g. Aerial Yoga, Pre-natal). Used by T1-2 bulk re-sign UI.
  const { data: allTemplates } = await supabase
    .from("waiver_templates")
    .select("id, title, is_active")
    .eq("studio_id", profile.studio_id)
    .order("created_at", { ascending: true });

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
      <div className="mb-4">
        <Link
          href="/settings"
          className="group inline-flex items-center gap-1 text-sm font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700"
        >
          <span className="inline-block transition-transform duration-150 ease-out group-hover:-translate-x-0.5">
            &larr;
          </span>
          Settings
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Waiver & Liability Release
          <HelpTip
            text="Create a liability waiver that members must sign. Unsigned members are highlighted in the member list."
            helpSlug="settings"
          />
        </h1>
        <ContextHelpLink href="/help/waivers/setup-waiver-template" />
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Protect your studio with a digital waiver. Members will sign electronically before their first class.
      </p>

      <WaiverSettingsClient
        template={template}
        studioName={studio?.name ?? "Your Studio"}
        signedCount={signedCount}
        totalCount={totalCount}
        unsignedMembers={unsignedMembers.map((m) => ({
          id: m.id,
          fullName: (m.profiles as { full_name?: string })?.full_name || "—",
          email: (m.profiles as { email?: string })?.email || "—",
        }))}
        allTemplates={(allTemplates || []).filter((t) => t.is_active !== false)}
      />
    </div>
  );
}
