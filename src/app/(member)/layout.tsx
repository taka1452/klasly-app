import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import WaiverGate from "@/components/waiver/waiver-gate";
import MemberLayoutClient from "@/components/member/member-layout-client";
import DevRoleSwitcher from "@/components/ui/dev-role-switcher";
import { getStudioFeatures } from "@/lib/features/check-feature";
import { FeatureProvider } from "@/lib/features/feature-context";
import AnnouncementBanner from "@/components/announcements/announcement-banner";
import PushPrompt from "@/components/pwa/push-prompt";
import { I18nProvider, type Locale } from "@/lib/i18n/context";
import { cookies } from "next/headers";

export default async function MemberLayout({
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
    .select("full_name, role, studio_id, onboarding_completed, onboarding_step, onboarding_started_at")
    .eq("id", user.id)
    .single();

  if (profile?.role === "owner") {
    redirect("/dashboard");
  }
  if (profile?.role === "instructor") {
    redirect("/instructor");
  }

  const needsWaiverCheck =
    profile?.studio_id != null && profile.studio_id !== "";
  let member: {
    id: string;
    waiver_signed: boolean;
    credits: number;
    current_rank?: string | null;
    lifetime_classes_attended?: number | null;
    rank_celebrated_at?: string | null;
  } | null = null;
  let waiverTemplate: { id: string; title: string; content: string } | null = null;

  if (needsWaiverCheck && profile.studio_id) {
    const [memberRes, templateRes] = await Promise.all([
      supabase
        .from("members")
        .select("id, waiver_signed, credits, current_rank, lifetime_classes_attended, rank_celebrated_at")
        .eq("profile_id", user.id)
        .eq("studio_id", profile.studio_id)
        .maybeSingle(),
      supabase
        .from("waiver_templates")
        .select("id, title, content")
        .eq("studio_id", profile.studio_id)
        .maybeSingle(),
    ]);
    member = memberRes.data ?? null;
    waiverTemplate = templateRes.data ?? null;
  }

  const needsWaiver =
    !!waiverTemplate && !!member && !member.waiver_signed;

  if (needsWaiver) {
    return <WaiverGate needsWaiver>{children}</WaiverGate>;
  }

  const onboardingCompleted =
    (profile as { onboarding_completed?: boolean })?.onboarding_completed ?? true;
  const onboardingStep =
    (profile as { onboarding_step?: number })?.onboarding_step ?? 0;
  const onboardingStartedAt =
    (profile as { onboarding_started_at?: string | null })?.onboarding_started_at ?? null;

  const features = profile?.studio_id
    ? await getStudioFeatures(profile.studio_id)
    : {};

  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("klasly-locale")?.value;
  const locale: Locale = localeCookie === "ja" ? "ja" : "en";

  const VALID_RANKS = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
  type RankT = typeof VALID_RANKS[number];
  const rawRank = member?.current_rank ?? null;
  const rank: RankT | null =
    rawRank && (VALID_RANKS as readonly string[]).includes(rawRank)
      ? (rawRank as RankT)
      : member
        ? "bronze"
        : null;
  const lifetimeClasses = member?.lifetime_classes_attended ?? null;
  const pendingRankCelebration =
    !!member && member.rank_celebrated_at == null && rank !== null && rank !== "bronze";

  return (
    <I18nProvider defaultLocale={locale}>
    <FeatureProvider features={features}>
      <AnnouncementBanner />
      <MemberLayoutClient
        userName={profile?.full_name || user.email || "User"}
        userEmail={user.email || ""}
        onboardingCompleted={onboardingCompleted}
        onboardingStep={onboardingStep}
        onboardingStartedAt={onboardingStartedAt}
        userId={user.id}
        memberCredits={member?.credits ?? null}
        rank={rank}
        lifetimeClasses={lifetimeClasses}
        pendingRankCelebration={pendingRankCelebration}
      >
        {children}
        <DevRoleSwitcher />
        <PushPrompt studioId={profile?.studio_id ?? undefined} />
      </MemberLayoutClient>
    </FeatureProvider>
    </I18nProvider>
  );
}
