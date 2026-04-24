/**
 * Report runner — takes a report_type + filters and returns chart-ready data
 * by querying the existing schema (no view-only duplication).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DateRangePreset,
  GroupBy,
  ReportFilters,
  ReportPoint,
  ReportResult,
  ReportType,
} from "./types";
import { REPORT_TYPE_META } from "./types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function subDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - n);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Resolve a DateRangePreset into [from, to] YYYY-MM-DD strings. */
export function resolveRange(
  filters: ReportFilters,
  now: Date = new Date()
): { from: string; to: string } {
  const preset: DateRangePreset = filters.date_range || "last_30_days";

  if (preset === "custom" && filters.date_from && filters.date_to) {
    return { from: filters.date_from, to: filters.date_to };
  }

  if (preset === "this_month") {
    return { from: toDateStr(startOfMonth(now)), to: toDateStr(endOfMonth(now)) };
  }
  if (preset === "last_month") {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { from: toDateStr(startOfMonth(prev)), to: toDateStr(endOfMonth(prev)) };
  }
  if (preset === "ytd") {
    return {
      from: `${now.getFullYear()}-01-01`,
      to: toDateStr(now),
    };
  }

  const days =
    preset === "last_7_days" ? 7 : preset === "last_90_days" ? 90 : 30;
  return { from: toDateStr(subDays(now, days - 1)), to: toDateStr(now) };
}

/** Compute the bucket key for a given date + groupBy. */
function bucketKey(dateStr: string, groupBy: GroupBy): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (groupBy === "day") {
    return dateStr;
  }
  if (groupBy === "month") {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  }
  // week: ISO-ish week starting Sunday. Key = YYYY-MM-DD of that Sunday.
  const dow = d.getUTCDay(); // 0 = Sun
  const sunday = new Date(d);
  sunday.setUTCDate(d.getUTCDate() - dow);
  return toDateStr(
    new Date(
      sunday.getUTCFullYear(),
      sunday.getUTCMonth(),
      sunday.getUTCDate()
    )
  );
}

function fillBuckets(
  from: string,
  to: string,
  groupBy: GroupBy,
  map: Map<string, ReportPoint>
): ReportPoint[] {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const out: ReportPoint[] = [];
  const seen = new Set<string>();

  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const key = bucketKey(toDateStr(cursor), groupBy);
    if (!seen.has(key)) {
      seen.add(key);
      const existing = map.get(key);
      out.push(existing ?? { label: key, value: 0 });
    }
    if (groupBy === "day") {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    } else if (groupBy === "week") {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    } else {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  return out;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function runReport(
  supabase: SupabaseClient,
  studioId: string,
  reportType: ReportType,
  filters: ReportFilters
): Promise<ReportResult> {
  const groupBy: GroupBy =
    filters.group_by || REPORT_TYPE_META[reportType].defaultGroupBy;
  const { from, to } = resolveRange(filters);

  switch (reportType) {
    case "revenue_over_time":
      return runRevenueOverTime(supabase, studioId, from, to, groupBy, filters);
    case "class_attendance":
      return runClassAttendance(supabase, studioId, from, to, groupBy, filters);
    case "instructor_payouts":
      return runInstructorPayouts(supabase, studioId, from, to, filters);
    case "member_growth":
      return runMemberGrowth(supabase, studioId, from, to, groupBy, filters);
    case "drop_in_counts":
      return runDropInCounts(supabase, studioId, from, to, groupBy, filters);
    case "room_utilization":
      return runRoomUtilization(supabase, studioId, from, to, groupBy, filters);
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}

async function runRevenueOverTime(
  supabase: SupabaseClient,
  studioId: string,
  from: string,
  to: string,
  groupBy: GroupBy,
  filters: ReportFilters
): Promise<ReportResult> {
  const { data } = await supabase
    .from("payments")
    .select("amount_cents, status, paid_at, created_at")
    .eq("studio_id", studioId)
    .eq("status", "paid")
    .gte("paid_at", `${from}T00:00:00Z`)
    .lte("paid_at", `${to}T23:59:59Z`);

  const map = new Map<string, ReportPoint>();
  let total = 0;
  for (const row of data || []) {
    const dateStr = (row.paid_at as string)?.slice(0, 10) ?? (row.created_at as string).slice(0, 10);
    const key = bucketKey(dateStr, groupBy);
    const amount = (row.amount_cents as number) || 0;
    total += amount;
    const p = map.get(key) || { label: key, value: 0 };
    p.value += amount;
    map.set(key, p);
  }

  const points = fillBuckets(from, to, groupBy, map).map((p) => ({
    ...p,
    value: Math.round(p.value),
  }));

  return {
    report_type: "revenue_over_time",
    filters,
    chart: {
      kind: "bar",
      xLabel: groupBy === "day" ? "Day" : groupBy === "week" ? "Week of" : "Month",
      yLabel: "Revenue ($ cents)",
      series: ["Revenue"],
      points,
    },
    summary: [
      { label: "Total revenue", value: formatCurrency(total) },
      {
        label: "Avg per period",
        value: formatCurrency(points.length > 0 ? Math.round(total / points.length) : 0),
      },
      { label: "Periods", value: String(points.length) },
    ],
  };
}

async function runClassAttendance(
  supabase: SupabaseClient,
  studioId: string,
  from: string,
  to: string,
  groupBy: GroupBy,
  filters: ReportFilters
): Promise<ReportResult> {
  let sessionsQuery = supabase
    .from("class_sessions")
    .select("id, session_date, capacity, is_cancelled, template_id, instructor_id")
    .eq("studio_id", studioId)
    .eq("is_cancelled", false)
    .gte("session_date", from)
    .lte("session_date", to);

  if (filters.instructor_id) {
    sessionsQuery = sessionsQuery.eq("instructor_id", filters.instructor_id);
  }
  if (filters.class_template_id) {
    sessionsQuery = sessionsQuery.eq("template_id", filters.class_template_id);
  }

  const { data: sessions } = await sessionsQuery;
  const sessionList = sessions || [];
  const sessionIds = sessionList.map((s) => s.id as string);

  let bookedCountById = new Map<string, number>();
  if (sessionIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("session_id, status")
      .in("session_id", sessionIds)
      .eq("status", "confirmed");
    bookedCountById = (bookings || []).reduce((map, b) => {
      const sid = b.session_id as string;
      map.set(sid, (map.get(sid) || 0) + 1);
      return map;
    }, new Map<string, number>());
  }

  const map = new Map<string, ReportPoint>();
  let attendance = 0;
  let capacity = 0;
  for (const s of sessionList) {
    const key = bucketKey(s.session_date as string, groupBy);
    const a = bookedCountById.get(s.id as string) || 0;
    const c = (s.capacity as number) || 0;
    attendance += a;
    capacity += c;
    const p = map.get(key) || { label: key, value: 0, value2: 0 };
    p.value += a;
    p.value2 = (p.value2 || 0) + c;
    map.set(key, p);
  }

  const points = fillBuckets(from, to, groupBy, map);

  return {
    report_type: "class_attendance",
    filters,
    chart: {
      kind: "bar",
      xLabel: groupBy === "day" ? "Day" : groupBy === "week" ? "Week of" : "Month",
      yLabel: "Attendance",
      series: ["Confirmed", "Capacity"],
      points,
    },
    summary: [
      {
        label: "Utilization",
        value:
          capacity > 0 ? `${Math.round((attendance / capacity) * 100)}%` : "0%",
      },
      { label: "Confirmed", value: String(attendance) },
      { label: "Capacity", value: String(capacity) },
    ],
  };
}

async function runInstructorPayouts(
  supabase: SupabaseClient,
  studioId: string,
  from: string,
  to: string,
  filters: ReportFilters
): Promise<ReportResult> {
  let q = supabase
    .from("instructor_invoices")
    .select(
      "period_start, total_cents, tier_charge_cents, overage_charge_cents, flat_fee_cents, instructor_id, instructors(profiles(full_name))"
    )
    .eq("studio_id", studioId)
    .gte("period_start", from)
    .lte("period_start", to)
    .order("period_start");

  if (filters.instructor_id) {
    q = q.eq("instructor_id", filters.instructor_id);
  }

  const { data } = await q;

  // One point per month period; label = "2026-04", value = total cents.
  const map = new Map<string, ReportPoint>();
  let total = 0;
  for (const inv of data || []) {
    const period = inv.period_start as string;
    const key = period.slice(0, 7); // YYYY-MM
    const amount = (inv.total_cents as number) || 0;
    total += amount;
    const p = map.get(key) || { label: key, value: 0 };
    p.value += amount;
    map.set(key, p);
  }

  const points = Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );

  return {
    report_type: "instructor_payouts",
    filters,
    chart: {
      kind: "bar",
      xLabel: "Month",
      yLabel: "Billed ($ cents)",
      series: ["Billed to instructors"],
      points,
    },
    summary: [
      { label: "Total billed", value: formatCurrency(total) },
      {
        label: "Avg per month",
        value: formatCurrency(points.length > 0 ? Math.round(total / points.length) : 0),
      },
      { label: "Invoices", value: String((data || []).length) },
    ],
  };
}

async function runMemberGrowth(
  supabase: SupabaseClient,
  studioId: string,
  from: string,
  to: string,
  groupBy: GroupBy,
  filters: ReportFilters
): Promise<ReportResult> {
  const { data } = await supabase
    .from("members")
    .select("created_at, status")
    .eq("studio_id", studioId)
    .gte("created_at", `${from}T00:00:00Z`)
    .lte("created_at", `${to}T23:59:59Z`);

  const map = new Map<string, ReportPoint>();
  let joined = 0;
  for (const m of data || []) {
    const dateStr = (m.created_at as string).slice(0, 10);
    const key = bucketKey(dateStr, groupBy);
    joined += 1;
    const p = map.get(key) || { label: key, value: 0 };
    p.value += 1;
    map.set(key, p);
  }

  const points = fillBuckets(from, to, groupBy, map);

  return {
    report_type: "member_growth",
    filters,
    chart: {
      kind: "line",
      xLabel: groupBy === "day" ? "Day" : groupBy === "week" ? "Week of" : "Month",
      yLabel: "New members",
      series: ["Joined"],
      points,
    },
    summary: [
      { label: "New members", value: String(joined) },
      {
        label: "Avg per period",
        value: String(points.length > 0 ? (joined / points.length).toFixed(1) : "0"),
      },
    ],
  };
}

async function runDropInCounts(
  supabase: SupabaseClient,
  studioId: string,
  from: string,
  to: string,
  groupBy: GroupBy,
  filters: ReportFilters
): Promise<ReportResult> {
  const { data } = await supabase
    .from("drop_in_attendances")
    .select("attended_at")
    .eq("studio_id", studioId)
    .gte("attended_at", `${from}T00:00:00Z`)
    .lte("attended_at", `${to}T23:59:59Z`);

  const map = new Map<string, ReportPoint>();
  let total = 0;
  for (const row of data || []) {
    const dateStr = (row.attended_at as string).slice(0, 10);
    const key = bucketKey(dateStr, groupBy);
    total += 1;
    const p = map.get(key) || { label: key, value: 0 };
    p.value += 1;
    map.set(key, p);
  }

  const points = fillBuckets(from, to, groupBy, map);

  return {
    report_type: "drop_in_counts",
    filters,
    chart: {
      kind: "bar",
      xLabel: groupBy === "day" ? "Day" : groupBy === "week" ? "Week of" : "Month",
      yLabel: "Drop-ins",
      series: ["Drop-ins"],
      points,
    },
    summary: [{ label: "Total drop-ins", value: String(total) }],
  };
}

async function runRoomUtilization(
  supabase: SupabaseClient,
  studioId: string,
  from: string,
  to: string,
  groupBy: GroupBy,
  filters: ReportFilters
): Promise<ReportResult> {
  const { data } = await supabase
    .from("class_sessions")
    .select("session_date, duration_minutes, room_id, rooms(name)")
    .eq("studio_id", studioId)
    .eq("is_cancelled", false)
    .not("room_id", "is", null)
    .gte("session_date", from)
    .lte("session_date", to);

  // Aggregate minutes per room.
  const perRoom = new Map<string, { name: string; minutes: number }>();
  let totalMinutes = 0;
  for (const row of data || []) {
    const rawRoom = row.rooms as unknown;
    const room = (Array.isArray(rawRoom) ? rawRoom[0] : rawRoom) as
      | { name: string }
      | null;
    const name = room?.name || "Unknown";
    const mins = (row.duration_minutes as number) || 0;
    totalMinutes += mins;
    const existing = perRoom.get(name) || { name, minutes: 0 };
    existing.minutes += mins;
    perRoom.set(name, existing);
  }

  const points: ReportPoint[] = Array.from(perRoom.values())
    .sort((a, b) => b.minutes - a.minutes)
    .map((r) => ({
      label: r.name,
      value: r.minutes,
    }));

  return {
    report_type: "room_utilization",
    filters,
    chart: {
      kind: "bar",
      xLabel: "Room",
      yLabel: "Booked minutes",
      series: ["Minutes"],
      points,
    },
    summary: [
      { label: "Total minutes", value: String(totalMinutes) },
      { label: "Hours", value: (totalMinutes / 60).toFixed(1) },
      { label: "Rooms tracked", value: String(points.length) },
    ],
  };
}
