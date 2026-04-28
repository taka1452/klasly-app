"use client";

import {
  RANK_LABEL,
  RANK_BG_CLASS,
  RANK_GRADIENT_CLASS,
  getRankProgress,
  type Rank,
} from "@/lib/rank";

type Props = {
  rank: Rank;
  lifetimeClasses: number;
};

const pluralize = (n: number, one: string, many: string) =>
  n === 1 ? one : many;

export default function RankCard({ rank, lifetimeClasses }: Props) {
  const progress = getRankProgress(lifetimeClasses);

  return (
    <div className={`card ${RANK_BG_CLASS[rank]}`}>
      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${RANK_GRADIENT_CLASS[rank]} text-lg font-bold text-white shadow-sm`}
          aria-hidden="true"
        >
          {RANK_LABEL[rank][0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-base font-semibold">
              {RANK_LABEL[rank]} member
            </span>
            <span className="text-xs opacity-75">
              {lifetimeClasses} {pluralize(lifetimeClasses, "class", "classes")} attended
            </span>
          </div>
          {progress.next && progress.toNext !== null ? (
            <>
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/60"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.progressPct}
                aria-label={`${progress.toNext} ${pluralize(progress.toNext, "class", "classes")} to ${RANK_LABEL[progress.next]}`}
              >
                <div
                  className={`h-full w-full origin-left bg-gradient-to-r ${RANK_GRADIENT_CLASS[progress.next]} transition-transform duration-500 ease-out`}
                  style={{ transform: `scaleX(${progress.progressPct / 100})` }}
                />
              </div>
              <p className="mt-1.5 text-xs opacity-80">
                {progress.toNext} more{" "}
                {pluralize(progress.toNext, "class", "classes")} to reach{" "}
                <span className="font-semibold">
                  {RANK_LABEL[progress.next]}
                </span>
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-xs opacity-80">
              You&apos;ve reached the top rank. Keep practicing!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
