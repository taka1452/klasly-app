"use client";

import type { AchievementType } from "@/types/database";

type Config = {
  label: string;
  glyph: string;
  /** True when the glyph is a Unicode symbol that needs to render larger
   *  to match the optical weight of letter/number glyphs. */
  symbol?: boolean;
  color: string;
};

const ACHIEVEMENT_CONFIG: Record<AchievementType, Config> = {
  first_class: { label: "First Class", glyph: "1", color: "bg-blue-100 text-blue-700" },
  five_classes: { label: "5 Classes", glyph: "5", color: "bg-green-100 text-green-700" },
  ten_classes: { label: "10 Classes", glyph: "10", color: "bg-brand-100 text-brand-700" },
  twenty_five_classes: { label: "25 Classes", glyph: "25", color: "bg-orange-100 text-orange-700" },
  fifty_classes: { label: "50 Classes", glyph: "50", color: "bg-red-100 text-red-700" },
  streak_7_days: { label: "1 Week Streak", glyph: "1W", color: "bg-cyan-100 text-cyan-700" },
  streak_30_days: { label: "1 Month Streak", glyph: "1M", color: "bg-amber-100 text-amber-700" },
  streak_90_days: { label: "3 Month Streak", glyph: "3M", color: "bg-pink-100 text-pink-700" },
  five_instructors: {
    label: "5 Instructors",
    glyph: "★",
    symbol: true,
    color: "bg-violet-100 text-violet-700",
  },
  five_class_types: {
    label: "Class Explorer",
    glyph: "✦",
    symbol: true,
    color: "bg-emerald-100 text-emerald-700",
  },
  time_explorer: {
    label: "All-Day Yogi",
    glyph: "☀",
    symbol: true,
    color: "bg-indigo-100 text-indigo-700",
  },
};

type BadgeIconProps = {
  type: AchievementType;
  size?: "sm" | "md";
};

export default function BadgeIcon({ type, size = "md" }: BadgeIconProps) {
  const config = ACHIEVEMENT_CONFIG[type];
  if (!config) return null;

  // Letter/number glyphs sit visually smaller than symbols at the same
  // font-size, so symbols use a slightly larger type to match weight.
  const baseSize = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const glyphSize = config.symbol
    ? size === "sm"
      ? "text-[14px]"
      : "text-[18px]"
    : size === "sm"
      ? "text-[10px]"
      : "text-xs";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${baseSize} ${glyphSize} ${config.color} flex items-center justify-center rounded-full font-bold leading-none`}
        title={config.label}
        aria-hidden="true"
      >
        {config.glyph}
      </div>
      <span className="text-[10px] text-gray-500 text-center leading-tight">
        {config.label}
      </span>
    </div>
  );
}
