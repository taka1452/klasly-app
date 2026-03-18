import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import MemberHeader from "@/components/member/member-header";
import DashboardShell from "@/components/ui/dashboard-shell";
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
    .select("role, full_name, studio_id")
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

  // メンバー用レイアウト
  return (
    <div className="min-h-screen bg-gray-50">
      <MemberHeader
        userName={profile.full_name || user.email || "Member"}
        userEmail={user.email || ""}
      />
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex gap-6">
            <Link
              href="/schedule"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Schedule
            </Link>
            <Link
              href="/my-bookings"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              My Bookings
            </Link>
            <Link
              href="/purchase"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Purchase
            </Link>
            <Link
              href="/my-payments"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Payments
            </Link>
            <Link
              href="/messages"
              className="text-sm font-semibold text-brand-700 hover:text-brand-900"
            >
              Messages
            </Link>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
