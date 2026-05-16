import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import MemberSearch from "@/components/members/member-search";
import MembersListClient from "@/components/members/members-list-client";
import MembersToolbarActions from "@/components/members/members-toolbar-actions";
import BulkEmailBar from "@/components/members/bulk-email-bar";
import FlowHintPanel from "@/components/ui/flow-hint-panel";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import ContextHelpLink from "@/components/help/context-help-link";
import EmptyState from "@/components/ui/empty-state";
import { getEmptyStateVideo } from "@/lib/empty-state-videos";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Members - Klasly",
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tag?: string }>;
}) {
  const params = await searchParams;

  // checkManagerPermission already does getUser + profile + managers query
  const permCheck = await checkManagerPermission("can_manage_members");
  if (!permCheck.allowed) {
    redirect("/dashboard");
  }

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
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    redirect("/onboarding");
  }

  // 会員一覧とインストラクター情報を並列取得
  let membersQuery = supabase
    .from("members")
    .select("*, profiles(full_name, email, phone)")
    .eq("studio_id", profile.studio_id)
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    membersQuery = membersQuery.eq("status", params.status);
  }
  if (params.tag && params.tag !== "all") {
    membersQuery = membersQuery.contains("tags", [params.tag]);
  }

  const [{ data: members }, { data: instructorRows }] = await Promise.all([
    membersQuery,
    supabase
      .from("instructors")
      .select("profile_id")
      .eq("studio_id", profile.studio_id),
  ]);

  const tagSet = new Set<string>();
  for (const m of (members || []) as { tags?: string[] }[]) {
    for (const t of m.tags || []) tagSet.add(t);
  }
  const allTags = Array.from(tagSet).sort();

  const instructorProfileIds = new Set(
    (instructorRows ?? []).map((i: { profile_id: string }) => i.profile_id)
  );

  // 検索フィルター（クライアントサイド）
  let filteredMembers = members || [];
  if (params.q) {
    const searchLower = params.q.toLowerCase();
    filteredMembers = filteredMembers.filter((m: { profiles?: { full_name?: string; email?: string } }) => {
      const name = m.profiles?.full_name?.toLowerCase() || "";
      const email = m.profiles?.email?.toLowerCase() || "";
      return name.includes(searchLower) || email.includes(searchLower);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <p className="text-sm text-gray-500">
            {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}
          </p>
          <ContextHelpLink href="/help/members/add-member" />
          {/* Hint chips fight for space on phones; show on tablet+ */}
          <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <FlowHintPanel flowType="members" />
            <FlowHintPanel flowType="member-invite" buttonLabel="Where to send invite?" />
          </div>
        </div>
        <MembersToolbarActions
          exportFilename={`members-${new Date().toISOString().slice(0, 10)}.csv`}
        />
      </div>

      {/* 検索・フィルター */}
      <MemberSearch
        currentQuery={params.q || ""}
        currentStatus={params.status || "all"}
        currentTag={params.tag || "all"}
        allTags={allTags}
      />

      {/* Bulk-email bar — only appears when a tag filter is active. */}
      <BulkEmailBar
        tag={params.tag || "all"}
        filteredCount={filteredMembers.length}
      />

      {/* 会員一覧 */}
      <div className="mt-4">
        {filteredMembers.length === 0 ? (
          params.q || params.status ? (
            <div className="card py-12 text-center">
              <p className="text-sm text-gray-500">No members match your search.</p>
            </div>
          ) : (
            <EmptyState
              title="No members yet"
              description="Add your first member, or import your existing member list from a spreadsheet."
              actionLabel="+ Add member"
              actionHref="/members/new"
              secondaryLabel="Import from CSV"
              secondaryHref="/members/import"
              helpHref="/help/members/add-member"
              helpLabel="How to add members"
              videoUrl={getEmptyStateVideo("members")}
            />
          )
        ) : (
          <MembersListClient members={filteredMembers} instructorProfileIds={Array.from(instructorProfileIds)} />
        )}
      </div>
    </div>
  );
}
