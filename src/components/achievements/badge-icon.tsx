"use client";

import type { AchievementType } from "@/types/database";

const ACHIEVEMENT_CONFIG: Record<AchievementType, { label: string; emoji: string; color: string }> = {
  first_class: { label: "First Class", emoji: "1", color: "bg-blue-100 text-blue-700" },
  five_classes: { label: "5 Classes", emoji: "5", color: "bg-green-100 text-green-700" },
  ten_classes: { label: "10 Classes", emoji: "10", color: "bg-purple-100 text-purple-700" },
  twenty_five_classes: { label: "25 Classes", emoji: "25", color: "bg-orange-100 text-orange-700" },
  fifty_classes: { label: "50 Classes", emoji: "50", color: "bg-red-100 text-red-700" },
  streak_7_days: { label: "1 Week Streak", emoji: "7d", color: "bg-cyan-100 text-cyan-700" },
  streak_30_days: { label: "1 Month Streak", emoji: "30d", color: "bg-amber-100 text-amber-700" },
  streak_90_days: { label: "3 Month Streak", emoji: "90d", color: "bg-pink-100 text-pink-700" },
};

type BadgeIconProps = {
  type: AchievementType;
  size?: "sm" | "md";
};

export default function BadgeIcon({ type, size = "md" }: BadgeIconProps) {
  const config = ACHIEVEMENT_CONFIG[type];
  if (!config) return null;

  const sizeClass = size === "sm"
    ? "h-8 w-8 text-[10px]"
    : "h-10 w-10 text-xs";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${sizeClass} ${config.color} flex items-center justify-center rounded-full font-bold`}
        title={config.label}
      >
        {config.emoji}
      </div>
      <span className="text-[10px] text-gray-500 text-center leading-tight">
        {config.label}
      </span>
    </div>
  );
}
