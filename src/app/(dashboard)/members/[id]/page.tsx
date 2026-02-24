import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatCredits, formatDate, getPlanLabel, getStatusColor } from "@/lib/utils";
import MemberEditForm from "@/components/members/member-edit-form";
import MemberDeleteButton from "@/components/members/member-delete-button";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : serverSupabase;

  const { data: member } = await supabase
    .from("members")
    .select("*, profiles(full_name, email, phone)")
    .eq("id", id)
    .single();

  if (!member) {
    notFound();
  }

  // オーナーの studio_id と一致するか確認
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("studio_id")
    .eq("id", user.id)
    .single();

  if (ownerProfile?.studio_id !== member.studio_id) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/members"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to members
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {member.profiles?.full_name || "Unknown"}
            </h1>
            <p className="text-sm text-gray-500">
              {member.profiles?.email || "—"}
            </p>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium capitalize ${getStatusColor(
              member.status
            )}`}
          >
            {member.status}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左: メンバー情報 */}
        <div className="lg:col-span-2">
          <MemberEditForm
            memberId={member.id}
            initialData={{
              fullName: member.profiles?.full_name || "",
              phone: member.profiles?.phone || "",
              planType: member.plan_type,
              credits: member.credits,
              status: member.status,
              notes: member.notes || "",
            }}
            profileId={member.profile_id}
          />
        </div>

        {/* 右: サイドパネル */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-sm font-medium text-gray-500">Member Info</h3>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-xs text-gray-400">Plan</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {getPlanLabel(member.plan_type)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Credits</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatCredits(member.credits)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Joined</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatDate(member.joined_at)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="card">
            <h3 className="text-sm font-medium text-red-600">Danger Zone</h3>
            <p className="mt-2 text-xs text-gray-500">
              Permanently remove this member and their data.
            </p>
            <MemberDeleteButton memberId={member.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
