import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import ReferralSettingsClient from "@/components/settings/referral-settings-client";
import HelpTip from "@/components/ui/help-tip";

export const metadata: Metadata = {
  title: "Referral Program - Klasly",
};

export default async function ReferralSettingsPage() {
  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || (profile?.role !== "owner" && profile?.role !== "manager")) {
    redirect("/");
  }

  // リファーラルコードを取得
  const { data: refCode } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("studio_id", profile.studio_id)
    .maybeSingle();

  // 紹介実績を取得
  const { data: rewards } = await supabase
    .from("referral_rewards")
    .select("id, referred_studio_id, status, completed_at, created_at")
    .eq("referrer_studio_id", profile.studio_id)
    .order("created_at", { ascending: false });

  // 被紹介者のスタジオ名を取得
  const referredStudioIds = (rewards ?? []).map((r) => r.referred_studio_id);
  let studioNames: Record<string, string> = {};
  if (referredStudioIds.length > 0) {
    const { data: studios } = await supabase
      .from("studios")
      .select("id, name")
      .in("id", referredStudioIds);
    studioNames = Object.fromEntries(
      (studios ?? []).map((s) => [s.id, s.name])
    );
  }

  const completedCount = (rewards ?? []).filter((r) => r.status === "completed").length;
  const savedAmount = completedCount * 19; // $19/month

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">
        Referral Program
        <HelpTip
          text="Share your link. When they pay, you both get 1 month free. No limit on referrals."
          helpSlug="referral-program"
        />
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Share your link and earn free months
      </p>
      <ReferralSettingsClient
        initialCode={refCode?.code ?? null}
        rewards={(rewards ?? []).map((r) => ({
          id: r.id,
          studioName: studioNames[r.referred_studio_id] ?? "Studio",
          status: r.status as "pending" | "completed" | "expired",
          completedAt: r.completed_at,
          createdAt: r.created_at,
        }))}
        completedCount={completedCount}
        savedAmount={savedAmount}
      />
    </div>
  );
}
