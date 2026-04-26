import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/ui/dashboard-shell";
import PlanLockScreen from "@/components/ui/plan-lock-screen";
import PlanBanner from "@/components/ui/plan-banner";
import TrialBanner from "@/components/ui/trial-banner";
import { getPlanAccess } from "@/lib/plan-guard";
import { isAdmin } from "@/lib/admin/auth";
import type { SetupTask } from "@/components/ui/setup-task-list";
import DevRoleSwitcher from "@/components/ui/dev-role-switcher";
import { getStudioFeatures } from "@/lib/features/check-feature";
import { getOwnerSetupTasks } from "@/lib/setup-tasks";
import { FeatureProvider } from "@/lib/features/feature-context";
import AnnouncementBanner from "@/components/announcements/announcement-banner";
import { getManagerPermissions, type ManagerPermissions } from "@/lib/auth/check-manager-permission";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminSupabase = serviceRoleKey
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      )
    : supabase;

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("*, studios(*)")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) {
    redirect("/onboarding");
  }

  if (profile?.role === "instructor") {
    redirect("/instructor");
  }
  if (profile?.role === "member") {
    redirect("/schedule");
  }
  // owner と manager のみダッシュボードにアクセス可
  if (profile?.role !== "owner" && profile?.role !== "manager") {
    redirect("/login");
  }

  const showAdminLink = await isAdmin();

  const studio = profile.studios as {
    stripe_subscription_id?: string | null;
    plan_status?: string | null;
    grace_period_ends_at?: string | null;
    trial_ends_at?: string | null;
    stripe_connect_onboarding_complete?: boolean | null;
    drop_in_price?: number | null;
    monthly_price?: number | null;
    payout_model?: string | null;
    studio_fee_percentage?: number | null;
  } | null;

  const onboardingCompleted =
    (profile as { onboarding_completed?: boolean })?.onboarding_completed ?? true;
  const onboardingStep =
    (profile as { onboarding_step?: number })?.onboarding_step ?? 0;
  const onboardingStartedAt =
    (profile as { onboarding_started_at?: string | null })?.onboarding_started_at ?? null;

  let setupTasks: SetupTask[] = [];
  if (profile.role === "owner" && profile.studio_id) {
    setupTasks = await getOwnerSetupTasks(
      adminSupabase,
      profile.studio_id,
      studio,
      onboardingCompleted,
    );
  }

  // プラン未設定でもダッシュボードにアクセス可能（トライアルバナーで誘導）
  // オンボーディング未完了（スタジオ作成直後でcompleteを経由していない）場合のみリダイレクト
  if (!studio?.plan_status || studio.plan_status === "none") {
    redirect("/onboarding/complete");
  }

  // トライアル期限切れ判定: plan_status=trialing + Stripe未登録 + trial_ends_at 過去
  const isTrialExpired =
    studio?.plan_status === "trialing" &&
    !studio?.stripe_subscription_id &&
    studio?.trial_ends_at &&
    new Date(studio.trial_ends_at) < new Date();

  const planStatus = isTrialExpired ? "expired" : (studio?.plan_status ?? "trialing");
  const planAccess = getPlanAccess(planStatus);

  if (planAccess.isFullyLocked) {
    return <PlanLockScreen />;
  }

  const showBanner =
    planStatus === "past_due" || planStatus === "grace";
  const showTrialBanner =
    (planStatus === "trialing" || planStatus === "expired") && !studio?.stripe_subscription_id;

  const features = await getStudioFeatures(profile.studio_id);

  // マネージャーの権限情報を取得（サイドバーのフィルタリング用）
  let managerPermissions: ManagerPermissions | null = null;
  if (profile.role === "manager") {
    managerPermissions = await getManagerPermissions(user.id, profile.studio_id);
  }

  // オーナーまたはマネージャーがインストラクターとしても登録されているか
  let isAlsoInstructor = false;
  if (profile.role === "owner" || profile.role === "manager") {
    const { data: instrRec } = await adminSupabase
      .from("instructors")
      .select("id")
      .eq("profile_id", user.id)
      .eq("studio_id", profile.studio_id)
      .maybeSingle();
    isAlsoInstructor = !!instrRec;
  }

  return (
    <FeatureProvider features={features}>
    <AnnouncementBanner />
    <DashboardShell
      currentRole={profile.role}
      studioName={(profile.studios as { name?: string })?.name || "My Studio"}
      userName={profile.full_name || user.email || "User"}
      userEmail={user.email || ""}
      planAccess={planAccess}
      showAdminLink={showAdminLink}
      isAlsoInstructor={isAlsoInstructor}
      managerPermissions={managerPermissions}
      onboardingCompleted={onboardingCompleted}
      onboardingStep={onboardingStep}
      onboardingStartedAt={onboardingStartedAt}
      userId={user.id}
      banner={
        showBanner ? (
          <PlanBanner
            planStatus={planStatus}
            gracePeriodEndsAt={studio?.grace_period_ends_at ?? null}
          />
        ) : showTrialBanner ? (
          <TrialBanner
            planStatus={planStatus}
            trialEndsAt={studio?.trial_ends_at ?? null}
            hasSubscription={!!studio?.stripe_subscription_id}
          />
        ) : null
      }
      setupTasks={setupTasks}
      setupGuideHref={
        studio?.payout_model === "instructor_direct"
          ? "/settings/collective-setup"
          : null
      }
    >
      {children}
      <DevRoleSwitcher />
    </DashboardShell>
    </FeatureProvider>
  );
}
