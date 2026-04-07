import type { SupabaseClient } from "@supabase/supabase-js";
import type { AchievementType } from "@/types/database";

const MILESTONES: { type: AchievementType; count: number }[] = [
  { type: "first_class", count: 1 },
  { type: "five_classes", count: 5 },
  { type: "ten_classes", count: 10 },
  { type: "twenty_five_classes", count: 25 },
  { type: "fifty_classes", count: 50 },
];

const STREAK_DAYS: { type: AchievementType; days: number }[] = [
  { type: "streak_7_days", days: 7 },
  { type: "streak_30_days", days: 30 },
  { type: "streak_90_days", days: 90 },
];

/**
 * Check and award achievements for a member.
 * Call after attendance is marked or booking confirmed.
 */
export async function checkAndAwardAchievements(
  supabase: SupabaseClient,
  memberId: string,
  studioId: string
) {
  // Get existing achievements
  const { data: existing } = await supabase
    .from("member_achievements")
    .select("achievement_type")
    .eq("member_id", memberId);

  const earned = new Set((existing || []).map((a) => a.achievement_type));

  // Get confirmed bookings for past sessions (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const today = new Date().toISOString().split("T")[0];

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, class_sessions(session_date)")
    .eq("member_id", memberId)
    .eq("status", "confirmed");

  // Count total past attended classes
  const pastDates: string[] = [];
  (bookings || []).forEach((b) => {
    const session = Array.isArray(b.class_sessions)
      ? b.class_sessions[0]
      : b.class_sessions;
    const date = (session as { session_date?: string })?.session_date;
    if (date && date <= today) {
      pastDates.push(date);
    }
  });

  const totalClasses = pastDates.length;
  const newAchievements: { achievement_type: AchievementType; metadata: Record<string, unknown> }[] = [];

  // Check milestones
  for (const milestone of MILESTONES) {
    if (totalClasses >= milestone.count && !earned.has(milestone.type)) {
      newAchievements.push({
        achievement_type: milestone.type,
        metadata: { total_classes: totalClasses },
      });
    }
  }

  // Check streaks (consecutive weeks with at least one class)
  if (pastDates.length > 0) {
    const uniqueDates = Array.from(new Set(pastDates)).sort();
    const recentDates = uniqueDates.filter((d) => d >= ninetyDaysAgo.toISOString().split("T")[0]);

    // Calculate streak in days from most recent class going backwards
    if (recentDates.length > 0) {
      let streakDays = 0;
      const todayDate = new Date(today);

      // Check if there's a class today or within the last 7 days
      const latestDate = new Date(recentDates[recentDates.length - 1]);
      const daysSinceLatest = Math.floor(
        (todayDate.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLatest <= 7) {
        // Calculate week-based streak
        const weekSet = new Set<string>();
        for (const d of recentDates) {
          const date = new Date(d);
          const weekStart = new Date(date);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          weekSet.add(weekStart.toISOString().split("T")[0]);
        }

        const sortedWeeks = Array.from(weekSet).sort().reverse();
        let consecutiveWeeks = 1;
        for (let i = 1; i < sortedWeeks.length; i++) {
          const prev = new Date(sortedWeeks[i - 1]);
          const curr = new Date(sortedWeeks[i]);
          const diff = Math.floor(
            (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diff <= 8) {
            consecutiveWeeks++;
          } else {
            break;
          }
        }

        streakDays = consecutiveWeeks * 7;

        for (const streak of STREAK_DAYS) {
          if (streakDays >= streak.days && !earned.has(streak.type)) {
            newAchievements.push({
              achievement_type: streak.type,
              metadata: { streak_days: streakDays, consecutive_weeks: consecutiveWeeks },
            });
          }
        }
      }
    }
  }

  // Insert new achievements
  if (newAchievements.length > 0) {
    await supabase.from("member_achievements").insert(
      newAchievements.map((a) => ({
        studio_id: studioId,
        member_id: memberId,
        achievement_type: a.achievement_type,
        metadata: a.metadata,
      }))
    );
  }

  return newAchievements;
}
