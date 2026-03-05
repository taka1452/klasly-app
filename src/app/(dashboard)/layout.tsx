import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/ui/dashboard-shell";
import PlanLockScreen from "@/components/ui/plan-lock-screen";
import PlanBanner from "@/components/ui/plan-banner";
import { getPlanAccess } from "@/lib/plan-guard";
import { isAdmin } from "@/lib/admin/auth";
import type { SetupTask } from "@/components/ui/setup-task-list";

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

  const showAdminLink = await isAdmin();

  const studio = profile.studios as {
    stripe_subscription_id?: string | null;
    plan_status?: string | null;
    grace_period_ends_at?: string | null;
    stripe_connect_onboarding_complete?: boolean | null;
    drop_in_price?: number | null;
    monthly_price?: number | null;
  } | null;

  const onboardingCompleted =
    (profile as { onboarding_completed?: boolean })?.onboarding_completed ?? true;
  const onboardingStep =
    (profile as { onboarding_step?: number })?.onboarding_step ?? 0;
  const onboardingStartedAt =
    (profile as { onboarding_started_at?: string | null })?.onboarding_started_at ?? null;

  let setupTasks: SetupTask[] = [];
  if (profile.role === "owner" && profile.studio_id) {
    const [{ count: classesCount }, { count: instructorsCount }, { count: membersCount }, { count: productsCount }] =
      await Promise.all([
        adminSupabase.from("classes").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id),
        adminSupabase.from("instructors").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id),
        adminSupabase.from("members").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id),
        adminSupabase.from("products").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id).eq("is_active", true),
      ]);
    const hasPricing = (productsCount ?? 0) > 0;
    setupTasks = [
      {
        id: "tutorial",
        label: "Complete the tutorial",
        done: onboardingCompleted,
      },
      {
        id: "stripe-connect",
        label: "Connect Stripe Connect",
        done: studio?.stripe_connect_onboarding_complete ?? false,
        href: "/settings/connect",
      },
      {
        id: "create-class",
        label: "Create at least one class",
        done: (classesCount ?? 0) >= 1,
        href: "/classes/new",
      },
      {
        id: "add-instructor",
        label: "Add an instructor",
        done: (instructorsCount ?? 0) >= 1,
        href: "/instructors/new",
      },
      {
        id: "add-member",
        label: "Add a member",
        done: (membersCount ?? 0) >= 1,
        href: "/members/new",
      },
      {
        id: "pricing",
        label: "Set pricing",
        done: hasPricing,
        href: "/settings/pricing",
      },
    ];
  }

  // stripe_subscription_idがなく、かつplan_statusがactiveでもtrialingでもない場合のみリダイレクト
  // （管理者がDBで直接activeに設定したケースや、無料トライアル開始時を考慮）
  const hasValidPlan =
    studio?.stripe_subscription_id ||
    studio?.plan_status === "active" ||
    studio?.plan_status === "trialing";
  if (!hasValidPlan) {
    redirect("/onboarding/plan");
  }

  const planStatus = studio?.plan_status ?? "trialing";
  const planAccess = getPlanAccess(planStatus);

  if (planAccess.isFullyLocked) {
    return <PlanLockScreen />;
  }

  const showBanner =
    planStatus === "past_due" || planStatus === "grace";

  return (
    <DashboardShell
      currentRole={profile.role}
      studioName={(profile.studios as { name?: string })?.name || "My Studio"}
      userName={profile.full_name || user.email || "User"}
      userEmail={user.email || ""}
      planAccess={planAccess}
      showAdminLink={showAdminLink}
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
        ) : null
      }
      setupTasks={setupTasks}
    >
      {children}
    </DashboardShell>
  );
}
