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
    const [{ count: classesCount }, { count: instructorsCount }, { count: membersCount }, { count: productsCount }, { data: widgetSettings }] =
      await Promise.all([
        adminSupabase.from("classes").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id),
        adminSupabase.from("instructors").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id),
        adminSupabase.from("members").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id),
        adminSupabase.from("products").select("id", { count: "exact", head: true }).eq("studio_id", profile.studio_id).eq("is_active", true),
        adminSupabase.from("widget_settings").select("enabled").eq("studio_id", profile.studio_id).maybeSingle(),
      ]);
    const hasPricing = (productsCount ?? 0) > 0;
    const widgetEnabled = (widgetSettings as { enabled?: boolean } | null)?.enabled ?? false;
    setupTasks = [
      {
        id: "tutorial",
        label: "Complete the tutorial",
        done: onboardingCompleted,
        hint: "Take a quick tour to learn the dashboard.",
      },
      {
        id: "stripe-connect",
        label: "Connect Stripe Connect",
        done: studio?.stripe_connect_onboarding_complete ?? false,
        href: "/settings/connect",
        hint: "Required so members can pay for classes and packs online.",
      },
      {
        id: "create-class",
        label: "Create at least one class",
        done: (classesCount ?? 0) >= 1,
        href: "/classes/new",
        hint: "Add a recurring class (e.g. Yoga Monday 10am) so members can book.",
      },
      {
        id: "add-instructor",
        label: "Add an instructor",
        done: (instructorsCount ?? 0) >= 1,
        href: "/instructors/new",
        hint: "Invite instructors to manage their classes and attendance.",
      },
      {
        id: "add-member",
        label: "Add a member",
        done: (membersCount ?? 0) >= 1,
        href: "/members/new",
        hint: "Add members so they can book classes and purchase credits.",
      },
      {
        id: "pricing",
        label: "Products & Pricing",
        done: hasPricing,
        href: "/settings/pricing",
        hint: "Create plans and packages (e.g. drop-in, class packs, monthly) for members to buy.",
      },
      {
        id: "widget",
        label: "Set up website widget",
        done: widgetEnabled,
        href: "/settings/widget",
        hint: "Embed your class schedule on your website so visitors can browse and book.",
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
