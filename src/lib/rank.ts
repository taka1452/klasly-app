export type Rank = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export const RANK_ORDER: Rank[] = ["bronze", "silver", "gold", "platinum", "diamond"];

export const RANK_THRESHOLDS: Record<Rank, number> = {
  bronze: 0,
  silver: 10,
  gold: 30,
  platinum: 100,
  diamond: 300,
};

export const RANK_LABEL: Record<Rank, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
};

// Tailwind utility classes — kept separate so components can compose
export const RANK_RING_CLASS: Record<Rank, string> = {
  bronze: "ring-amber-700/60",
  silver: "ring-slate-400",
  gold: "ring-yellow-400",
  platinum: "ring-cyan-400",
  diamond: "ring-fuchsia-400",
};

export const RANK_TEXT_CLASS: Record<Rank, string> = {
  bronze: "text-amber-700",
  silver: "text-slate-500",
  gold: "text-yellow-600",
  platinum: "text-cyan-600",
  diamond: "text-fuchsia-600",
};

export const RANK_BG_CLASS: Record<Rank, string> = {
  bronze: "bg-amber-50 text-amber-800 border-amber-200",
  silver: "bg-slate-50 text-slate-700 border-slate-200",
  gold: "bg-yellow-50 text-yellow-800 border-yellow-200",
  platinum: "bg-cyan-50 text-cyan-800 border-cyan-200",
  diamond: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
};

export const RANK_GRADIENT_CLASS: Record<Rank, string> = {
  bronze: "from-amber-700 to-amber-900",
  silver: "from-slate-300 to-slate-500",
  gold: "from-yellow-300 to-yellow-500",
  platinum: "from-cyan-300 to-cyan-500",
  diamond: "from-fuchsia-300 to-purple-500",
};

export function rankFromCount(count: number): Rank {
  if (count >= RANK_THRESHOLDS.diamond) return "diamond";
  if (count >= RANK_THRESHOLDS.platinum) return "platinum";
  if (count >= RANK_THRESHOLDS.gold) return "gold";
  if (count >= RANK_THRESHOLDS.silver) return "silver";
  return "bronze";
}

export function nextRank(rank: Rank): Rank | null {
  const idx = RANK_ORDER.indexOf(rank);
  if (idx < 0 || idx >= RANK_ORDER.length - 1) return null;
  return RANK_ORDER[idx + 1];
}

export type RankProgress = {
  rank: Rank;
  count: number;
  next: Rank | null;
  nextThreshold: number | null;
  toNext: number | null;
  progressPct: number; // 0-100, 100 if maxed
};

export function getRankProgress(count: number): RankProgress {
  const rank = rankFromCount(count);
  const next = nextRank(rank);
  if (!next) {
    return {
      rank,
      count,
      next: null,
      nextThreshold: null,
      toNext: null,
      progressPct: 100,
    };
  }
  const currentBase = RANK_THRESHOLDS[rank];
  const nextThreshold = RANK_THRESHOLDS[next];
  const span = nextThreshold - currentBase;
  const into = count - currentBase;
  return {
    rank,
    count,
    next,
    nextThreshold,
    toNext: nextThreshold - count,
    progressPct: Math.min(100, Math.max(0, Math.round((into / span) * 100))),
  };
}
