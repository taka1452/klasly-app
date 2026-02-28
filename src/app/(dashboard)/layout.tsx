import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/ui/dashboard-shell";
import PlanLockScreen from "@/components/ui/plan-lock-screen";
import PlanBanner from "@/components/ui/plan-banner";
import { getPlanAccess } from "@/lib/plan-guard";
import { isAdmin } from "@/lib/admin/auth";

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
  } | null;

  if (!studio?.stripe_subscription_id) {
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
      banner={
        showBanner ? (
          <PlanBanner
            planStatus={planStatus}
            gracePeriodEndsAt={studio?.grace_period_ends_at ?? null}
          />
        ) : null
      }
    >
      {children}
    </DashboardShell>
  );
}
