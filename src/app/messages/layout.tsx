import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import DashboardShell from "@/components/ui/dashboard-shell";
import MemberShell from "@/components/member/member-shell";
import { getPlanAccess } from "@/lib/plan-guard";
import { isAdmin } from "@/lib/admin/auth";
import { getStudioFeatures } from "@/lib/features/check-feature";
import { FeatureProvider } from "@/lib/features/feature-context";

/**
 * /messages レイアウト
 * ルートグループ外に配置することでオーナー・メンバー両方がアクセス可能。
 * ロールに応じて適切なナビゲーション chrome を描画する。
 */
export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    .select(
      "role, full_name, studio_id, onboarding_completed, onboarding_step, onboarding_started_at"
    )
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    redirect("/onboarding");
  }

  if (profile.role === "instructor") {
    redirect("/instructor");
  }

  // オーナー / マネージャー: DashboardShell（サイドバー付き）
  if (profile.role === "owner" || profile.role === "manager") {
    const showAdminLink = await isAdmin();

    const { data: studio } = await supabase
      .from("studios")
      .select("name, plan_status")
      .eq("id", profile.studio_id)
      .single();

    const planStatus = (studio as { plan_status?: string })?.plan_status ?? "trialing";
    const planAccess = getPlanAccess(planStatus);

    let isAlsoInstructor = false;
    if (profile.role === "owner") {
      const { data: instrRec } = await supabase
        .from("instructors")
        .select("id")
        .eq("profile_id", user.id)
        .eq("studio_id", profile.studio_id)
        .maybeSingle();
      isAlsoInstructor = !!instrRec;
    }

    const features = await getStudioFeatures(profile.studio_id);

    return (
      <FeatureProvider features={features}>
        <DashboardShell
          currentRole={profile.role}
          studioName={(studio as { name?: string })?.name || "My Studio"}
          studioId={profile.studio_id}
          userName={profile.full_name || user.email || "User"}
          userEmail={user.email || ""}
          planAccess={planAccess}
          showAdminLink={showAdminLink}
          isAlsoInstructor={isAlsoInstructor}
        >
          {children}
        </DashboardShell>
      </FeatureProvider>
    );
  }

  // メンバー: WaiverGate チェック
  const { data: waiverTemplate } = await supabase
    .from("waiver_templates")
    .select("id")
    .eq("studio_id", profile.studio_id)
    .maybeSingle();

  if (waiverTemplate) {
    const { data: member } = await supabase
      .from("members")
      .select("waiver_signed")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .maybeSingle();

    if (member && !member.waiver_signed) {
      redirect("/waiver");
    }
  }

  return (
    <MemberShell
      userId={user.id}
      userEmail={user.email || ""}
      fullName={profile.full_name || user.email || "Member"}
      studioId={profile.studio_id}
      onboardingCompleted={profile.onboarding_completed ?? true}
      onboardingStep={profile.onboarding_step ?? 0}
      onboardingStartedAt={profile.onboarding_started_at ?? null}
    >
      {children}
    </MemberShell>
  );
}
