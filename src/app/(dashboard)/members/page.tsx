import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import MemberSearch from "@/components/members/member-search";
import MembersListClient from "@/components/members/members-list-client";
import ExportCsvButton from "@/components/ui/export-csv-button";
import FlowHintPanel from "@/components/ui/flow-hint-panel";
import { checkManagerPermission } from "@/lib/auth/check-manager-permission";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Members - Klasly",
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // マネージャー権限チェック（can_manage_members）
  const permCheck = await checkManagerPermission("can_manage_members");
  if (!permCheck.allowed) {
    redirect("/dashboard");
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

  // 会員一覧を取得（profiles と JOIN、waiver_signed 含む）
  let query = supabase
    .from("members")
    .select("*, profiles(full_name, email, phone)")
    .eq("studio_id", profile.studio_id)
    .order("created_at", { ascending: false });

  // ステータスフィルター
  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data: members } = await query;

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Members</h1>
            <p className="mt-1 text-sm text-gray-500">
              {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}
            </p>
          </div>
          <FlowHintPanel flowType="members" />
          <FlowHintPanel flowType="member-invite" buttonLabel="Where to send invite?" />
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton
            url="/api/export/members"
            filename={`members-${new Date().toISOString().slice(0, 10)}.csv`}
          />
          <Link href="/members/import" className="btn-secondary">
            Import CSV
          </Link>
          <Link href="/members/new" className="btn-primary">
            + Add member
          </Link>
        </div>
      </div>

      {/* 検索・フィルター */}
      <MemberSearch
        currentQuery={params.q || ""}
        currentStatus={params.status || "all"}
      />

      {/* 会員一覧 */}
      <div className="mt-4">
        {filteredMembers.length === 0 ? (
          params.q || params.status ? (
            <div className="card py-12 text-center">
              <p className="text-sm text-gray-500">No members match your search.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-6 py-16 text-center">
              <p className="text-base font-medium text-gray-900">
                No members yet. Add your first member or import from CSV.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Link href="/members/new" className="btn-primary">
                  + Add member
                </Link>
                <Link href="/members/import" className="btn-secondary">
                  Import from CSV
                </Link>
              </div>
            </div>
          )
        ) : (
          <MembersListClient members={filteredMembers} />
        )}
      </div>
    </div>
  );
}
