"use client";

import { useEffect, useRef, useState } from "react";
import InstructorBadgeIcon from "./instructor-badge-icon";
import type { InstructorAchievementType } from "@/types/database";

type Achievement = {
  id: string;
  achievement_type: InstructorAchievementType;
  earned_at: string;
};

const STORAGE_KEY = "klasly_instructor_achievement_count";

export default function InstructorAchievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTypes, setNewTypes] = useState<Set<string>>(new Set());
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    fetch("/api/instructor/achievements")
      .then((res) => (res.ok ? res.json() : { achievements: [] }))
      .then((data) => {
        const list: Achievement[] = data.achievements ?? [];
        setAchievements(list);

        if (!hasCheckedRef.current && list.length > 0) {
          hasCheckedRef.current = true;
          const prev = parseInt(sessionStorage.getItem(STORAGE_KEY) || "0", 10);
          if (list.length > prev) {
            const newOnes = list.slice(prev);
            setNewTypes(new Set(newOnes.map((a) => a.id)));
            window.dispatchEvent(new CustomEvent("instructor-achievement-earned"));
          }
          sessionStorage.setItem(STORAGE_KEY, String(list.length));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (achievements.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        Your Achievements
      </h2>
      <div className="card">
        <div className="flex flex-wrap gap-4">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={newTypes.has(a.id) ? "animate-badge-pop" : ""}
            >
              <InstructorBadgeIcon type={a.achievement_type} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
