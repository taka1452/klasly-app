"use client";

import type { AchievementType } from "@/types/database";
import BadgeIcon from "./badge-icon";

type MemberAchievementsProps = {
  achievements: { achievement_type: AchievementType; earned_at: string }[];
};

export default function MemberAchievements({ achievements }: MemberAchievementsProps) {
  if (achievements.length === 0) return null;

  return (
    <div className="card mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Your Achievements</h3>
      <div className="flex flex-wrap gap-3">
        {achievements.map((a) => (
          <BadgeIcon key={a.achievement_type} type={a.achievement_type} size="sm" />
        ))}
      </div>
    </div>
  );
}
