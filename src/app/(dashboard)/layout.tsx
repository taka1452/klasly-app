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
    const [{ count: classesCount }, { count: instructorsCount }, { count: membersCount }, { count: productsCount }, { data: widgetSettings }, { count: waiverCount }] =
      await Promise.all([
        adminSupabase.from("classes").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id),
        adminSupabase.from("instructors").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id),
        adminSupabase.from("members").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id),
        adminSupabase.from("products").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id).eq("is_active", true),
        adminSupabase.from("widget_settings").select("enabled").eq("studio_id", profile.studio_id).maybeSingle(),
        adminSupabase.from("waiver_templates").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id),
      ]);
    const hasPricing = (productsCount ?? 0) > 0;
    const widgetEnabled = (widgetSettings as { enabled?: boolean } | null)?.enabled ?? false;
    setupTasks = [
      {
        id: "tutorial",
        label: "Complete the tutorial",
        done: onboardingCompleted,
        hint: "Take a quick tour to learn the dashboard.",
        helpHref: "/help/getting-started/studio-setup-overview",
      },
      {
        id: "stripe-connect",
        label: "Connect Stripe",
        done: studio?.stripe_connect_onboarding_complete ?? false,
        href: "/settings/connect",
        hint: "Required so members can pay for classes online.",
        helpHref: "/help/getting-started/connect-stripe",
      },
      {
        id: "create-class",
        label: "Create at least one class",
        done: (classesCount ?? 0) >= 1,
        href: "/calendar/new",
        hint: "Add a recurring class so members can book.",
        helpHref: "/help/classes-scheduling/create-recurring-class",
      },
      {
        id: "add-instructor",
        label: "Add an instructor",
        done: (instructorsCount ?? 0) >= 1,
        href: "/instructors/new",
        hint: "Invite instructors to manage their classes.",
        helpHref: "/help/collective-mode/invite-instructor",
      },
      {
        id: "add-member",
        label: "Add a member",
        done: (membersCount ?? 0) >= 1,
        href: "/members/new",
        hint: "Add or import members so they can start booking.",
        helpHref: "/help/members/add-member",
      },
      {
        id: "pricing",
        label: "Set up pricing",
        done: hasPricing,
        href: "/settings/pricing",
        hint: "Create plans and packages for members to buy.",
        helpHref: "/help/payments/create-products",
      },
      {
        id: "waiver",
        label: "Set up waiver template",
        done: (waiverCount ?? 0) >= 1,
        href: "/settings/waiver",
        hint: "Create a liability waiver for members to sign.",
        helpHref: "/help/settings/waiver-template",
      },
      {
        id: "widget",
        label: "Set up website widget",
        done: widgetEnabled,
        href: "/settings/widget",
        hint: "Embed your class schedule on your website.",
        helpHref: "/help/settings/embed-wordpress-widget",
      },
      {
        id: "choose-plan",
        label: "Choose a plan",
        done: !!studio?.stripe_subscription_id,
        href: "/settings/billing",
        hint: "Your 30-day trial is active. Subscribe to keep your studio running.",
        helpHref: "/help/settings/manage-subscription",
      },
    ];

    // Collective Mode: add extra setup tasks
    if (studio?.payout_model === "instructor_direct") {
      const [{ count: roomsCount }, { count: tiersCount }] = await Promise.all([
        adminSupabase.from("rooms").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id),
        adminSupabase.from("instructor_membership_tiers").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id),
      ]);

      const classTaskIndex = setupTasks.findIndex(t => t.id === "create-class");
      const collectiveTasks: SetupTask[] = [
        {
          id: "setup-rooms",
          label: "Set up rooms",
          done: (roomsCount ?? 0) >= 1,
          href: "/settings/rooms",
          hint: "Define the rooms instructors can book.",
          helpHref: "/help/collective-mode/collective-room-management",
        },
        {
          id: "setup-tiers",
          label: "Define membership tiers",
          done: (tiersCount ?? 0) >= 1,
          href: "/settings/tiers",
          hint: "Create monthly tiers for instructors.",
          helpHref: "/help/collective-mode/collective-tiers",
        },
      ];

      setupTasks.splice(classTaskIndex + 1, 0, ...collectiveTasks);
    }
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
    >
      {children}
      <DevRoleSwitcher />
    </DashboardShell>
    </FeatureProvider>
  );
}
