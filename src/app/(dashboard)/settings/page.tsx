import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import SettingsContent from "@/components/settings/settings-content";

export const metadata: Metadata = {
  title: "Settings - Klasly",
};

export default async function SettingsPage() {
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
    .select("full_name, email, studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id || profile?.role !== "owner") {
    redirect("/");
  }

  // スタジオ設定を取得
  const { data: studio } = await supabase
    .from("studios")
    .select("booking_requires_credits, stripe_connect_onboarding_complete, session_generation_weeks")
    .eq("id", profile.studio_id)
    .single();

  const bookingRequiresCredits =
    (studio as { booking_requires_credits?: boolean | null } | null)
      ?.booking_requires_credits ?? null;
  const stripeConnectComplete =
    (studio as { stripe_connect_onboarding_complete?: boolean } | null)
      ?.stripe_connect_onboarding_complete ?? false;
  const sessionGenerationWeeks =
    (studio as { session_generation_weeks?: number } | null)
      ?.session_generation_weeks ?? 8;

  // オーナーが自分をインストラクターとして登録しているか
  const { data: instructorRecord } = await supabase
    .from("instructors")
    .select("id")
    .eq("profile_id", user.id)
    .eq("studio_id", profile.studio_id)
    .maybeSingle();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage your studio, payments, and account
      </p>

      <SettingsContent
        fullName={profile.full_name || user.email || "\u2014"}
        email={profile.email || user.email || "\u2014"}
        bookingRequiresCredits={bookingRequiresCredits}
        stripeConnectComplete={stripeConnectComplete}
        isAlsoInstructor={!!instructorRecord}
        sessionGenerationWeeks={sessionGenerationWeeks}
      />
    </div>
  );
}
