import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getStudioFeatures } from "@/lib/features/check-feature";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import { getWrapped, isWrappedActive } from "@/lib/wrapped";
import { RANK_LABEL, RANK_GRADIENT_CLASS } from "@/lib/rank";
import BadgeIcon from "@/components/achievements/badge-icon";
import RevealOnScroll from "@/components/levels/reveal-on-scroll";
import WrappedShareButton from "@/components/levels/wrapped-share-button";
import type { AchievementType } from "@/types/database";

const ACHIEVEMENT_TYPES: AchievementType[] = [
  "first_class",
  "five_classes",
  "ten_classes",
  "twenty_five_classes",
  "fifty_classes",
  "streak_7_days",
  "streak_30_days",
  "streak_90_days",
];

function isAchievementType(t: string): t is AchievementType {
  return (ACHIEVEMENT_TYPES as string[]).includes(t);
}

const SECTION =
  "snap-start min-h-[100svh] flex flex-col items-center justify-center px-6 py-12 text-center";

export default async function WrappedPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { year: yearStr } = await params;
  const { preview } = await searchParams;
  const year = parseInt(yearStr, 10);
  if (!Number.isFinite(year) || year < 2024 || year > 2100) notFound();

  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) redirect("/login");

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
    : serverSupabase;

  const { data: member } = await supabase
    .from("members")
    .select("id, studio_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!member) redirect("/my-bookings");

  const features = await getStudioFeatures(member.studio_id);
  if (features[FEATURE_KEYS.MEMBER_LEVELS] !== true) redirect("/my-bookings");

  const isPreview = preview === "1";
  if (!isPreview && !isWrappedActive(year)) {
    redirect("/my-bookings");
  }

  const wrapped = await getWrapped(member.id, year);
  if (!wrapped) redirect("/my-bookings");

  const hours = Math.floor(wrapped.totalMinutes / 60);
  const mins = wrapped.totalMinutes % 60;

  if (wrapped.totalClasses === 0) {
    return (
      <div className={SECTION}>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Your {year}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">
          See you on the mat in {year + 1}
        </h1>
        <p className="mt-3 max-w-sm text-sm text-gray-600">
          You didn&apos;t mark any attended classes this year. Your Wrapped will
          be ready next time around.
        </p>
        <Link href="/my-bookings" className="btn-primary mt-6">
          Back to bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-4 md:-my-6 h-[100svh] snap-y snap-mandatory overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <section className={SECTION}>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Your {year}
        </p>
        <h1 className="mt-3 bg-gradient-to-br from-brand-600 via-fuchsia-500 to-amber-500 bg-clip-text text-5xl font-extrabold leading-tight text-transparent md:text-6xl">
          A year on the mat
        </h1>
        <p className="mt-4 max-w-sm text-sm text-gray-600">
          Scroll to see how it went.
        </p>
      </section>

      <RevealOnScroll className={SECTION}>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Classes attended
        </p>
        <p className="mt-3 text-7xl font-extrabold tabular-nums text-gray-900 md:text-8xl">
          {wrapped.totalClasses}
        </p>
        <p className="mt-3 text-sm text-gray-600">
          That&apos;s {wrapped.totalClasses === 1 ? "a class" : "a lot of showing up"}.
        </p>
      </RevealOnScroll>

      <RevealOnScroll className={SECTION}>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Time on the mat
        </p>
        <p className="mt-3 text-6xl font-extrabold tabular-nums text-gray-900 md:text-7xl">
          {hours}
          <span className="text-3xl text-gray-500"> hr</span>
          {mins > 0 && (
            <>
              {" "}
              {mins}
              <span className="text-3xl text-gray-500"> min</span>
            </>
          )}
        </p>
        <p className="mt-3 max-w-xs text-sm text-gray-600">
          That&apos;s {hours} hour{hours === 1 ? "" : "s"} of breath, balance, and
          presence.
        </p>
      </RevealOnScroll>

      {wrapped.topInstructor && (
        <RevealOnScroll className={SECTION}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Your most-with instructor
          </p>
          <h2 className="mt-3 text-4xl font-bold text-gray-900 md:text-5xl">
            {wrapped.topInstructor.name}
          </h2>
          <p className="mt-3 text-sm text-gray-600">
            You took {wrapped.topInstructor.count} class
            {wrapped.topInstructor.count === 1 ? "" : "es"} together this year.
          </p>
        </RevealOnScroll>
      )}

      {wrapped.topClassType && (
        <RevealOnScroll className={SECTION}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Your favorite style
          </p>
          <h2 className="mt-3 text-4xl font-bold text-gray-900 md:text-5xl">
            {wrapped.topClassType.name}
          </h2>
          <p className="mt-3 text-sm text-gray-600">
            {wrapped.topClassType.count} sessions in your favorite groove.
          </p>
        </RevealOnScroll>
      )}

      {wrapped.rankChanged && (
        <RevealOnScroll className={SECTION}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            You leveled up
          </p>
          <div className="mt-4 flex items-center gap-4">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${RANK_GRADIENT_CLASS[wrapped.rankBefore]} text-2xl font-bold text-white opacity-60`}
              aria-hidden="true"
            >
              {RANK_LABEL[wrapped.rankBefore][0]}
            </div>
            <span className="text-2xl text-gray-400" aria-hidden="true">
              →
            </span>
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${RANK_GRADIENT_CLASS[wrapped.rankAfter]} text-3xl font-bold text-white shadow-lg`}
              aria-hidden="true"
            >
              {RANK_LABEL[wrapped.rankAfter][0]}
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            <span className="font-semibold text-gray-900">
              {RANK_LABEL[wrapped.rankBefore]}
            </span>{" "}
            →{" "}
            <span className="font-semibold text-gray-900">
              {RANK_LABEL[wrapped.rankAfter]}
            </span>
          </p>
        </RevealOnScroll>
      )}

      {wrapped.achievementsThisYear.length > 0 && (
        <RevealOnScroll className={SECTION}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Badges earned
          </p>
          <div className="mt-5 flex flex-wrap items-start justify-center gap-4">
            {wrapped.achievementsThisYear.map(
              (a) =>
                isAchievementType(a.type) && (
                  <BadgeIcon key={a.type} type={a.type} />
                )
            )}
          </div>
        </RevealOnScroll>
      )}

      {wrapped.studioPercentile !== null && (
        <RevealOnScroll className={SECTION}>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            You&apos;re in the
          </p>
          <p className="mt-3 text-7xl font-extrabold tabular-nums text-gray-900 md:text-8xl">
            top {wrapped.studioPercentile}%
          </p>
          <p className="mt-3 text-sm text-gray-600">
            of practitioners at your studio. Keep showing up.
          </p>
        </RevealOnScroll>
      )}

      <RevealOnScroll className={SECTION}>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Save & share
        </p>
        <h2 className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
          Take it with you
        </h2>
        <WrappedShareButton year={year} preview={isPreview} />
        <Link
          href="/my-bookings"
          className="mt-8 text-sm font-medium text-brand-700 hover:underline"
        >
          ← Back to bookings
        </Link>
      </RevealOnScroll>
    </div>
  );
}
