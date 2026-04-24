import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import LibraryMembershipsClient from "@/components/settings/library-memberships-client";

export const metadata: Metadata = {
  title: "Online library — Klasly",
};

export default async function LibrarySettingsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) redirect("/login");

  const perm = await checkManagerPermission();
  if (!perm.allowed) redirect("/dashboard");

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

  // Load members so admins can enroll them directly.
  const { data: members } = await supabase
    .from("members")
    .select("id, profile_id, profiles(full_name, email)")
    .eq("studio_id", profile.studio_id)
    .order("created_at", { ascending: false })
    .limit(500);

  const memberOptions = (members || []).map((m) => {
    const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: m.id as string,
      fullName: (prof as { full_name?: string } | null)?.full_name || "Member",
      email: (prof as { email?: string } | null)?.email || "",
    };
  });

  // Published library content count.
  const { count: publishedCount } = await supabase
    .from("video_content")
    .select("id", { count: "exact", head: true })
    .eq("studio_id", profile.studio_id)
    .eq("is_published", true);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Online library</h1>
        <p className="mt-1 text-sm text-gray-500">
          Paid on-demand class library. Enroll members, track subscriptions, and
          gate content by access tier (free / members / premium).
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Published content
          </div>
          <div className="mt-1 text-xl font-bold text-gray-900">
            {publishedCount ?? 0} videos
          </div>
        </div>
        <a
          href="/library"
          className="rounded-lg border border-gray-200 bg-white p-3 text-sm hover:bg-gray-50"
        >
          Go to library &rarr;
        </a>
      </div>

      <LibraryMembershipsClient members={memberOptions} />
    </div>
  );
}
