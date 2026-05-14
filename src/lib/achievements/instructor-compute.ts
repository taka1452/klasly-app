import type { SupabaseClient } from "@supabase/supabase-js";
import type { InstructorAchievementType } from "@/types/database";

const CLASS_MILESTONES: { type: InstructorAchievementType; count: number }[] = [
  { type: "first_class_taught", count: 1 },
  { type: "ten_classes_taught", count: 10 },
  { type: "fifty_classes_taught", count: 50 },
  { type: "hundred_classes_taught", count: 100 },
  { type: "five_hundred_classes_taught", count: 500 },
];

const STUDENT_MILESTONES: { type: InstructorAchievementType; count: number }[] = [
  { type: "first_student", count: 1 },
  { type: "fifty_students", count: 50 },
  { type: "hundred_students", count: 100 },
];

const EARNING_STREAKS: { type: InstructorAchievementType; months: number }[] = [
  { type: "earning_streak_3", months: 3 },
  { type: "earning_streak_6", months: 6 },
  { type: "earning_streak_12", months: 12 },
];

export async function checkAndAwardInstructorAchievements(
  supabase: SupabaseClient,
  instructorId: string,
  studioId: string
) {
  const { data: existing } = await supabase
    .from("instructor_achievements")
    .select("achievement_type")
    .eq("instructor_id", instructorId);

  const earned = new Set((existing || []).map((a) => a.achievement_type));

  const newAchievements: {
    achievement_type: InstructorAchievementType;
    metadata: Record<string, unknown>;
  }[] = [];

  const today = new Date().toISOString().split("T")[0];

  // --- Class milestones: count past sessions taught ---
  const { count: classCount } = await supabase
    .from("class_sessions")
    .select("id", { count: "exact", head: true })
    .eq("instructor_id", instructorId)
    .eq("is_cancelled", false)
    .lte("session_date", today);

  const totalClasses = classCount ?? 0;

  for (const milestone of CLASS_MILESTONES) {
    if (totalClasses >= milestone.count && !earned.has(milestone.type)) {
      newAchievements.push({
        achievement_type: milestone.type,
        metadata: { total_classes: totalClasses },
      });
    }
  }

  // --- Student milestones: unique members who booked this instructor's classes ---
  const { data: studentData } = await supabase
    .from("bookings")
    .select("member_id, class_sessions!inner(instructor_id)")
    .eq("class_sessions.instructor_id", instructorId)
    .eq("status", "confirmed");

  const uniqueStudents = new Set(
    (studentData || []).map((b) => b.member_id)
  );
  const totalStudents = uniqueStudents.size;

  for (const milestone of STUDENT_MILESTONES) {
    if (totalStudents >= milestone.count && !earned.has(milestone.type)) {
      newAchievements.push({
        achievement_type: milestone.type,
        metadata: { total_students: totalStudents },
      });
    }
  }

  // --- Full house: at least one session where bookings == capacity ---
  if (!earned.has("full_house")) {
    const { data: fullSessions } = await supabase
      .from("class_sessions")
      .select("id, capacity")
      .eq("instructor_id", instructorId)
      .eq("is_cancelled", false)
      .lte("session_date", today)
      .gt("capacity", 0)
      .limit(200);

    if (fullSessions && fullSessions.length > 0) {
      const sessionIds = fullSessions.map((s) => s.id);
      const capacityMap = new Map(fullSessions.map((s) => [s.id, s.capacity]));

      const { data: bookingCounts } = await supabase
        .from("bookings")
        .select("session_id")
        .in("session_id", sessionIds)
        .eq("status", "confirmed");

      const countBySession: Record<string, number> = {};
      for (const b of bookingCounts || []) {
        countBySession[b.session_id] = (countBySession[b.session_id] || 0) + 1;
      }

      for (const [sessionId, count] of Object.entries(countBySession)) {
        const cap = capacityMap.get(sessionId);
        if (cap && count >= cap) {
          newAchievements.push({
            achievement_type: "full_house",
            metadata: { session_id: sessionId, bookings: count, capacity: cap },
          });
          break;
        }
      }
    }
  }

  // --- Earning streaks: consecutive months with earnings > 0 ---
  const hasUnearned = EARNING_STREAKS.some((s) => !earned.has(s.type));
  if (hasUnearned) {
    const { data: allEarnings } = await supabase
      .from("instructor_earnings")
      .select("instructor_payout, created_at")
      .eq("instructor_id", instructorId)
      .gt("instructor_payout", 0);

    const monthSet = new Set<string>();
    for (const row of allEarnings || []) {
      const d = new Date(row.created_at);
      monthSet.add(
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
      );
    }

    if (monthSet.size > 0) {
      const now = new Date();
      let curY = now.getUTCFullYear();
      let curM = now.getUTCMonth() + 1;
      let streak = 0;

      while (true) {
        const key = `${curY}-${String(curM).padStart(2, "0")}`;
        if (!monthSet.has(key)) break;
        streak++;
        curM--;
        if (curM === 0) {
          curM = 12;
          curY--;
        }
        if (streak > 24) break;
      }

      for (const s of EARNING_STREAKS) {
        if (streak >= s.months && !earned.has(s.type)) {
          newAchievements.push({
            achievement_type: s.type,
            metadata: { streak_months: streak },
          });
        }
      }
    }
  }

  // --- Insert new achievements ---
  if (newAchievements.length > 0) {
    await supabase.from("instructor_achievements").insert(
      newAchievements.map((a) => ({
        studio_id: studioId,
        instructor_id: instructorId,
        achievement_type: a.achievement_type,
        metadata: a.metadata,
      }))
    );
  }

  return newAchievements;
}
