import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatCredits, getPlanLabel, getStatusColor } from "@/lib/utils";
import MemberSearch from "@/components/members/member-search";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user!.id)
    .single();

  // 会員一覧を取得（profiles と JOIN）
  let query = supabase
    .from("members")
    .select("*, profiles(full_name, email, phone)")
    .eq("studio_id", profile!.studio_id!)
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
        <Link href="/members/new" className="btn-primary">
          + Add member
        </Link>
      </div>

      {/* 検索・フィルター */}
      <MemberSearch
        currentQuery={params.q || ""}
        currentStatus={params.status || "all"}
      />

      {/* 会員一覧テーブル */}
      <div className="card mt-4 overflow-hidden p-0">
        {filteredMembers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500">
              {params.q || params.status
                ? "No members match your search."
                : "No members yet. Add your first member!"}
            </p>
          </div>
        ) : (
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
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredMembers.map((member: { id: string; profiles?: { full_name?: string; email?: string }; plan_type: string; credits: number; status: string }) => (
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
        )}
      </div>
    </div>
  );
}
