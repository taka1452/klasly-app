import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import MemberLayoutClient from "@/components/member/member-layout-client";
import DevRoleSwitcher from "@/components/ui/dev-role-switcher";
import { getStudioFeatures } from "@/lib/features/check-feature";
import { FeatureProvider } from "@/lib/features/feature-context";
import AnnouncementBanner from "@/components/announcements/announcement-banner";
import PushPrompt from "@/components/pwa/push-prompt";
import { I18nProvider, type Locale } from "@/lib/i18n/context";
import { cookies } from "next/headers";
import { computeStreakState } from "@/lib/streak";

type Props = {
  userId: string;
  userEmail: string;
  fullName: string;
  studioId: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  onboardingStartedAt: string | null;
  children: React.ReactNode;
};

const VALID_RANKS = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
type RankT = (typeof VALID_RANKS)[number];

/**
 * Server component that wraps member-role content in the full member chrome
 * (header + desktop nav + mobile drawer + floating bottom nav). Shared by
 * the (member) route group, /messages, and /account.
 */
export default async function MemberShell({
  userId,
  userEmail,
  fullName,
  studioId,
  onboardingCompleted,
  onboardingStep,
  onboardingStartedAt,
  children,
}: Props) {
  const serverSupabase = await createServerClient();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: member } = await supabase
    .from("members")
    .select(
      "id, credits, current_rank, lifetime_classes_attended, rank_celebrated_at, current_streak_weeks, longest_streak_weeks, last_attended_week"
    )
    .eq("profile_id", userId)
    .eq("studio_id", studioId)
    .maybeSingle();

  const features = await getStudioFeatures(studioId);
  const memberLevelsEnabled = features["extension.member_levels"] === true;

  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("klasly-locale")?.value;
  const locale: Locale = localeCookie === "ja" ? "ja" : "en";

  const rawRank = member?.current_rank ?? null;
  const rank: RankT | null = memberLevelsEnabled
    ? rawRank && (VALID_RANKS as readonly string[]).includes(rawRank)
      ? (rawRank as RankT)
      : member
        ? "bronze"
        : null
    : null;
  const lifetimeClasses = memberLevelsEnabled
    ? (member?.lifetime_classes_attended ?? null)
    : null;
  const pendingRankCelebration =
    memberLevelsEnabled &&
    !!member &&
    member.rank_celebrated_at == null &&
    rank !== null &&
    rank !== "bronze";

  const streak =
    memberLevelsEnabled && member
      ? computeStreakState(
          member.current_streak_weeks ?? 0,
          member.last_attended_week ?? null,
          member.longest_streak_weeks ?? 0
        )
      : null;

  return (
    <I18nProvider defaultLocale={locale}>
      <FeatureProvider features={features}>
        <AnnouncementBanner />
        <MemberLayoutClient
          userName={fullName}
          userEmail={userEmail}
          onboardingCompleted={onboardingCompleted}
          onboardingStep={onboardingStep}
          onboardingStartedAt={onboardingStartedAt}
          userId={userId}
          memberCredits={member?.credits ?? null}
          rank={rank}
          lifetimeClasses={lifetimeClasses}
          pendingRankCelebration={pendingRankCelebration}
          streakWeeks={streak?.weeks ?? 0}
          streakAtRisk={streak?.atRisk ?? false}
        >
          {children}
          <DevRoleSwitcher />
          <PushPrompt studioId={studioId} />
        </MemberLayoutClient>
      </FeatureProvider>
    </I18nProvider>
  );
}
