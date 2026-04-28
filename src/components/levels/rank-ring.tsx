"use client";

import {
  RANK_RING_CLASS,
  RANK_GRADIENT_CLASS,
  RANK_LABEL,
  type Rank,
} from "@/lib/rank";

type Props = {
  rank: Rank;
  initial: string;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-sm",
  lg: "h-20 w-20 text-2xl",
};

export default function RankRing({ rank, initial, size = "sm" }: Props) {
  return (
    <span
      role="img"
      aria-label={`${RANK_LABEL[rank]} member`}
      className={`relative inline-flex ${SIZE_CLASS[size]} rounded-full ring-2 ring-offset-2 ring-offset-white ${RANK_RING_CLASS[rank]}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${RANK_GRADIENT_CLASS[rank]} font-semibold text-white`}
      >
        {initial}
      </span>
    </span>
  );
}
