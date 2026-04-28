import { createClient } from "@supabase/supabase-js";
import { rankFromCount, type Rank } from "@/lib/rank";
import { unwrapRelation } from "@/lib/supabase/relation";

export type WrappedSummary = {
  year: number;
  memberId: string;
  studioId: string;
  totalClasses: number;
  totalMinutes: number;
  topInstructor: { name: string; count: number } | null;
  topClassType: { name: string; count: number } | null;
  rankBefore: Rank;
  rankAfter: Rank;
  rankChanged: boolean;
  achievementsThisYear: { type: string; earnedAt: string }[];
  studioPercentile: number | null; // top X% within studio (using lifetime totals)
  studioMemberCount: number;
};

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type SessionRel = {
  session_date: string | null;
  duration_minutes: number | null;
  instructor_id: string | null;
  classes:
    | { name: string | null; class_type: string | null }
    | { name: string | null; class_type: string | null }[]
    | null;
};

/**
 * Compute a member's year-in-review summary. Used by both the
 * /wrapped/[year] page and the /api/og/wrapped/[year] image generator
 * so both render the same numbers.
 */
export async function getWrapped(
  memberId: string,
  year: number
): Promise<WrappedSummary | null> {
  const supabase = adminClient();

  const { data: member } = await supabase
    .from("members")
    .select("id, studio_id, lifetime_classes_attended")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return null;

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [bookingsRes, dropInsRes, achRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        `attended, session_id,
         class_sessions:session_id (
           session_date, duration_minutes, instructor_id,
           classes:class_id ( name, class_type )
         )`
      )
      .eq("member_id", memberId)
      .eq("attended", true),
    supabase
      .from("drop_in_attendances")
      .select(
        `attended_at, session_id,
         class_sessions:session_id (
           session_date, duration_minutes, instructor_id,
           classes:class_id ( name, class_type )
         )`
      )
      .eq("member_id", memberId),
    supabase
      .from("member_achievements")
      .select("achievement_type, earned_at")
      .eq("member_id", memberId)
      .gte("earned_at", `${year}-01-01T00:00:00Z`)
      .lt("earned_at", `${year + 1}-01-01T00:00:00Z`),
  ]);

  type Row = {
    date: string;
    duration: number;
    instructorId: string | null;
    classType: string | null;
    className: string | null;
  };

  const all: Row[] = [];
  const inYear: Row[] = [];

  const collect = (date: string | null, s: SessionRel | null) => {
    if (!date) return;
    const cls = unwrapRelation<{ name: string | null; class_type: string | null }>(
      s?.classes ?? null
    );
    const row: Row = {
      date,
      duration: s?.duration_minutes ?? 0,
      instructorId: s?.instructor_id ?? null,
      classType: cls?.class_type ?? null,
      className: cls?.name ?? null,
    };
    all.push(row);
    if (date >= yearStart && date <= yearEnd) inYear.push(row);
  };

  for (const b of bookingsRes.data ?? []) {
    const s = unwrapRelation<SessionRel>(b.class_sessions);
    collect(s?.session_date ?? null, s ?? null);
  }
  for (const d of dropInsRes.data ?? []) {
    const s = unwrapRelation<SessionRel>(d.class_sessions);
    const date = (d.attended_at ?? s?.session_date ?? "").slice(0, 10) || null;
    collect(date, s ?? null);
  }

  const totalClasses = inYear.length;
  const totalMinutes = inYear.reduce((acc, r) => acc + r.duration, 0);
  const beforeYearCount = all.filter((r) => r.date < yearStart).length;
  const afterYearCount = beforeYearCount + totalClasses;

  // Top instructor
  const instCounts: Record<string, number> = {};
  for (const r of inYear) {
    if (!r.instructorId) continue;
    instCounts[r.instructorId] = (instCounts[r.instructorId] || 0) + 1;
  }
  const topInstructorEntry = Object.entries(instCounts).sort(
    (a, b) => b[1] - a[1]
  )[0];
  let topInstructor: WrappedSummary["topInstructor"] = null;
  if (topInstructorEntry) {
    const [id, count] = topInstructorEntry;
    const { data: instr } = await supabase
      .from("instructors")
      .select("profiles:profile_id ( full_name )")
      .eq("id", id)
      .maybeSingle();
    const p = unwrapRelation<{ full_name: string | null }>(instr?.profiles);
    topInstructor = { name: p?.full_name ?? "Instructor", count };
  }

  // Top class type
  const typeCounts: Record<string, number> = {};
  for (const r of inYear) {
    const key = (r.classType || r.className || "Other").trim() || "Other";
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  }
  const topTypeEntry = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
  const topClassType: WrappedSummary["topClassType"] = topTypeEntry
    ? { name: topTypeEntry[0], count: topTypeEntry[1] }
    : null;

  const rankBefore = rankFromCount(beforeYearCount);
  const rankAfter = rankFromCount(afterYearCount);

  // Studio percentile (lifetime-based — same as /my-stats logic)
  const { data: studioMembers, count } = await supabase
    .from("members")
    .select("lifetime_classes_attended", { count: "exact" })
    .eq("studio_id", member.studio_id);
  const totalMembers = count ?? studioMembers?.length ?? 0;
  let studioPercentile: number | null = null;
  if (totalMembers > 1 && studioMembers) {
    const myLifetime = member.lifetime_classes_attended ?? 0;
    const above = studioMembers.filter(
      (r) => (r.lifetime_classes_attended ?? 0) > myLifetime
    ).length;
    studioPercentile = Math.max(
      1,
      Math.min(100, Math.round(((above + 1) / totalMembers) * 100))
    );
  }

  return {
    year,
    memberId,
    studioId: member.studio_id,
    totalClasses,
    totalMinutes,
    topInstructor,
    topClassType,
    rankBefore,
    rankAfter,
    rankChanged: rankBefore !== rankAfter,
    achievementsThisYear: (achRes.data ?? []).map((a) => ({
      type: a.achievement_type,
      earnedAt: a.earned_at,
    })),
    studioPercentile,
    studioMemberCount: totalMembers,
  };
}

/**
 * True if today is inside the public reveal window for the year.
 * Dec 20 of the year through Feb 15 of the following year.
 */
export function isWrappedActive(year: number, now: Date = new Date()): boolean {
  const start = new Date(Date.UTC(year, 11, 20));
  const end = new Date(Date.UTC(year + 1, 1, 15, 23, 59, 59));
  return now >= start && now <= end;
}

/**
 * Returns the year whose Wrapped is currently in its public window, or
 * null if we're outside any window. Dec 20 → Feb 15 reveals the just-
 * completed year; in early Jan/Feb that means the previous calendar year.
 */
export function getActiveWrappedYear(now: Date = new Date()): number | null {
  const y = now.getUTCFullYear();
  if (isWrappedActive(y, now)) return y;
  if (isWrappedActive(y - 1, now)) return y - 1;
  return null;
}
