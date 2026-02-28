import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatCredits, formatDate, getPlanLabel, getStatusColor } from "@/lib/utils";
import MemberSearch from "@/components/members/member-search";
import ExportCsvButton from "@/components/ui/export-csv-button";
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
    return null; // middleware でリダイレクトされる想定
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
    return null; // オンボーディングへリダイレクトされる想定
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="mt-1 text-sm text-gray-500">
            {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton
            url="/api/export/members"
            filename={`members-${new Date().toISOString().slice(0, 10)}.csv`}
          />
          <Link href="/members/import" className="btn-secondary">
            📥 Import CSV
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
                  📥 Import from CSV
                </Link>
              </div>
            </div>
          )
        ) : (
          <>
            {/* モバイル: カードリスト */}
            <div className="space-y-3 sm:hidden">
              {filteredMembers.map((member: { id: string; profiles?: { full_name?: string; email?: string }; plan_type: string; credits: number; status: string; waiver_signed?: boolean; waiver_signed_at?: string }) => (
                <Link
                  key={member.id}
                  href={`/members/${member.id}`}
                  className="card block"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">
                        {member.profiles?.full_name || "—"}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500 truncate">
                        {member.profiles?.email || "—"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(
                            member.status
                          )}`}
                        >
                          {member.status}
                        </span>
                        {member.waiver_signed ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            ✓ {formatDate(member.waiver_signed_at ?? "")}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-brand-600">
                      View
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* デスクトップ: テーブル */}
            <div className="card hidden overflow-hidden p-0 sm:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Credits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Waiver
                    </th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMembers.map((member: { id: string; profiles?: { full_name?: string; email?: string }; plan_type: string; credits: number; status: string; waiver_signed?: boolean; waiver_signed_at?: string }) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {member.profiles?.full_name || "—"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {member.profiles?.email || "—"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {getPlanLabel(member.plan_type)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatCredits(member.credits)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(
                            member.status
                          )}`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {(member as { waiver_signed?: boolean; waiver_signed_at?: string }).waiver_signed ? (
                          <span className="inline-flex items-center gap-1 text-sm text-green-600">
                            <span>✓</span>
                            {formatDate(
                              (member as { waiver_signed_at: string }).waiver_signed_at ?? ""
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/members/${member.id}`}
                          className="text-sm font-medium text-brand-600 hover:text-brand-700"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
