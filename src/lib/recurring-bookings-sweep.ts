import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Auto-book sweep for member recurring rules.
 *
 * Runs lazily inside /api/member/sessions GET, so booked sessions show up
 * in the same response that surfaced the new ones. The sweep is idempotent:
 *   - Skips sessions the member already has any non-cancelled booking on
 *   - Skips sessions where confirmed_count >= capacity
 *   - Skips rules paused_until > today
 *
 * Returns the count of newly created bookings (for an optional toast in
 * the UI) without throwing — failures must never break the calendar load.
 */
export async function sweepRecurringBookings(args: {
  supabase: SupabaseClient;
  memberProfileId: string;
  memberRowId: string | null;
  studioId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}): Promise<{ created: number }> {
  const { supabase, memberProfileId, memberRowId, studioId, startDate, endDate } = args;
  if (!memberRowId) return { created: 0 };

  try {
    const today = new Date().toISOString().slice(0, 10);

    // Active rules for this member
    const { data: rules } = await supabase
      .from("recurring_bookings")
      .select("id, template_id, day_of_week, start_time, paused_until")
      .eq("member_id", memberProfileId)
      .eq("is_active", true);

    if (!rules || rules.length === 0) return { created: 0 };

    const activeRules = rules.filter((r) => {
      if (!r.paused_until) return true;
      return r.paused_until < today; // paused window has expired
    });
    if (activeRules.length === 0) return { created: 0 };

    // Pull every candidate session in range for the templates we care about.
    const templateIds = Array.from(
      new Set(activeRules.map((r) => r.template_id as string))
    );
    const { data: sessions } = await supabase
      .from("class_sessions")
      .select("id, template_id, session_date, start_time, capacity, is_cancelled, is_public")
      .eq("studio_id", studioId)
      .in("template_id", templateIds)
      .eq("is_cancelled", false)
      .eq("is_public", true)
      .gte("session_date", startDate)
      .lte("session_date", endDate);

    if (!sessions || sessions.length === 0) return { created: 0 };

    // Filter to sessions that match a rule (same template, weekday, start time).
    type Match = { sessionId: string; capacity: number };
    const matches: Match[] = [];
    for (const s of sessions) {
      const sessionDow = parseDow(s.session_date as string);
      const sessionStart = (s.start_time as string).slice(0, 8);
      const matched = activeRules.some(
        (r) =>
          r.template_id === s.template_id &&
          r.day_of_week === sessionDow &&
          (r.start_time as string).slice(0, 8) === sessionStart
      );
      if (matched) {
        matches.push({
          sessionId: s.id as string,
          capacity: (s.capacity as number) ?? 0,
        });
      }
    }

    if (matches.length === 0) return { created: 0 };

    const matchIds = matches.map((m) => m.sessionId);

    // Fetch existing non-cancelled bookings the member has on those sessions.
    const { data: existing } = await supabase
      .from("bookings")
      .select("session_id")
      .eq("member_id", memberRowId)
      .neq("status", "cancelled")
      .in("session_id", matchIds);

    const alreadyBooked = new Set(
      (existing ?? []).map((b: { session_id: string }) => b.session_id)
    );

    // Fetch confirmed counts for capacity check.
    const { data: confirmed } = await supabase
      .from("bookings")
      .select("session_id")
      .eq("status", "confirmed")
      .in("session_id", matchIds);
    const confirmedCounts: Record<string, number> = {};
    for (const c of confirmed ?? []) {
      const id = (c as { session_id: string }).session_id;
      confirmedCounts[id] = (confirmedCounts[id] ?? 0) + 1;
    }

    const toCreate = matches
      .filter((m) => !alreadyBooked.has(m.sessionId))
      .filter((m) => (confirmedCounts[m.sessionId] ?? 0) < m.capacity);

    if (toCreate.length === 0) return { created: 0 };

    const rows = toCreate.map((m) => ({
      session_id: m.sessionId,
      member_id: memberRowId,
      status: "confirmed",
      booked_via_recurring: true,
    }));

    const { error: insertErr } = await supabase.from("bookings").insert(rows);
    if (insertErr) {
      // Likely the bookings table doesn't yet have booked_via_recurring;
      // fall back to a minimal insert so the feature still works.
      const fallback = toCreate.map((m) => ({
        session_id: m.sessionId,
        member_id: memberRowId,
        status: "confirmed",
      }));
      await supabase.from("bookings").insert(fallback);
    }

    return { created: toCreate.length };
  } catch {
    return { created: 0 };
  }
}

/** Day of week (0 = Sunday … 6 = Saturday) for "YYYY-MM-DD" interpreted as local date. */
function parseDow(yyyyMmDd: string): number {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1).getDay();
}
