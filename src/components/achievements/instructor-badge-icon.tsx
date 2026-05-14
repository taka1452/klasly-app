"use client";

import type { InstructorAchievementType } from "@/types/database";

type Config = {
  label: string;
  glyph: string;
  symbol?: boolean;
  color: string;
};

const INSTRUCTOR_ACHIEVEMENT_CONFIG: Record<InstructorAchievementType, Config> = {
  first_class_taught: { label: "First Class Taught", glyph: "1", color: "bg-emerald-100 text-emerald-700" },
  ten_classes_taught: { label: "10 Classes Taught", glyph: "10", color: "bg-teal-100 text-teal-700" },
  fifty_classes_taught: { label: "50 Classes Taught", glyph: "50", color: "bg-cyan-100 text-cyan-700" },
  hundred_classes_taught: { label: "100 Classes Taught", glyph: "100", color: "bg-blue-100 text-blue-700" },
  five_hundred_classes_taught: { label: "500 Classes Taught", glyph: "500", color: "bg-indigo-100 text-indigo-700" },
  first_student: { label: "First Student", glyph: "♡", symbol: true, color: "bg-violet-100 text-violet-700" },
  fifty_students: { label: "50 Students", glyph: "50", color: "bg-purple-100 text-purple-700" },
  hundred_students: { label: "100 Students", glyph: "100", color: "bg-fuchsia-100 text-fuchsia-700" },
  earning_streak_3: { label: "3-Month Streak", glyph: "3M", color: "bg-amber-100 text-amber-700" },
  earning_streak_6: { label: "6-Month Streak", glyph: "6M", color: "bg-orange-100 text-orange-700" },
  earning_streak_12: { label: "1-Year Streak", glyph: "1Y", color: "bg-red-100 text-red-700" },
  full_house: { label: "Full House", glyph: "★", symbol: true, color: "bg-yellow-100 text-yellow-700" },
};

type Props = {
  type: InstructorAchievementType;
  size?: "sm" | "md";
};

export default function InstructorBadgeIcon({ type, size = "md" }: Props) {
  const config = INSTRUCTOR_ACHIEVEMENT_CONFIG[type];
  if (!config) return null;

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
      <span className="text-[10px] text-gray-500 text-center leading-tight max-w-[60px]">
        {config.label}
      </span>
    </div>
  );
}
