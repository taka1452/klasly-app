import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PrintAutoTrigger from "./print-auto-trigger";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Print schedule — Klasly",
};

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  is_cancelled: boolean | null;
  is_public: boolean | null;
  title: string | null;
  capacity: number | null;
  class_templates?: { name?: string | null } | null;
  rooms?: { name?: string | null } | null;
  instructors?: { full_name?: string | null } | null;
};

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default async function PrintSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; auto?: string }>;
}) {
  const params = await searchParams;
  const auto = params.auto !== "false";

  const serverSupabase = await createServerClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
    : serverSupabase;

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.studio_id) redirect("/");
  if (profile.role !== "owner" && profile.role !== "manager") redirect("/");

  const { data: studio } = await supabase
    .from("studios")
    .select("name")
    .eq("id", profile.studio_id)
    .single();

  // Resolve the week start (Sunday) from the ?week= param.
  const today = new Date();
  const requested = params.week ? parseLocalDate(params.week) : today;
  const weekStart = startOfWeek(requested);
  const weekEnd = addDays(weekStart, 6);

  const startIso = formatYMD(weekStart);
  const endIso = formatYMD(weekEnd);

  const { data: rawSessions } = await supabase
    .from("class_sessions")
    .select(
      "id, session_date, start_time, end_time, duration_minutes, is_cancelled, is_public, title, capacity, class_templates(name), rooms(name), instructors(full_name)"
    )
    .eq("studio_id", profile.studio_id)
    .gte("session_date", startIso)
    .lte("session_date", endIso)
    .neq("session_type", "room_only")
    .eq("is_cancelled", false)
    .order("session_date", { ascending: true })
    .order("start_time", { ascending: true });

  const sessions: SessionRow[] = (rawSessions ?? []) as SessionRow[];

  // Group sessions by date.
  const byDate = new Map<string, SessionRow[]>();
  for (let i = 0; i < 7; i++) {
    byDate.set(formatYMD(addDays(weekStart, i)), []);
  }
  for (const s of sessions) {
    const arr = byDate.get(s.session_date);
    if (arr) arr.push(s);
  }

  const studioName = studio?.name || "Klasly";
  const dateRangeLabel = `${weekStart.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  })} – ${weekEnd.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;

  return (
    <div className="print-page print-content mx-auto max-w-[1100px] bg-white p-6 text-sm text-gray-900">
      {auto && <PrintAutoTrigger />}

      <div className="print-only-hide mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
        <div>
          <strong>Print preview:</strong> {studioName} · week of {dateRangeLabel}
        </div>
        <div className="flex flex-wrap gap-2">
          <PreviousWeekLink weekStart={weekStart} />
          <NextWeekLink weekStart={weekStart} />
          <Link href="/calendar" className="btn-secondary">
            Back to schedule
          </Link>
          <button
            type="button"
            // Inline onClick wrapped via next-link impossible; use a tiny client form instead
            // but a plain button using the global window.print() also works in client boundary.
            // We expose this through PrintAutoTrigger's button below for simplicity.
            className="btn-primary"
            // The auto-trigger client component also exposes a button via portal;
            // here we keep this as a styled fallback.
            data-print-button
          >
            Print
          </button>
        </div>
      </div>

      <header className="mb-6 border-b border-gray-300 pb-3">
        <p className="text-xs uppercase tracking-wider text-gray-500">
          Weekly schedule
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-gray-900">
          {studioName}
        </h1>
        <p className="text-sm text-gray-600">{dateRangeLabel}</p>
      </header>

      <div className="space-y-4">
        {Array.from(byDate.entries()).map(([dateStr, daySessions], idx) => {
          const date = parseLocalDate(dateStr);
          const dayName = DAY_LABELS[date.getDay()];
          return (
            <section
              key={dateStr}
              className="print-row rounded-lg border border-gray-300"
            >
              <div className="flex items-baseline justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                  {dayName}
                </h2>
                <span className="text-xs tabular-nums text-gray-500">
                  {date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              {daySessions.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">
                  No classes scheduled.
                </p>
              ) : (
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="w-32 px-3 py-1.5 font-medium">Time</th>
                      <th className="px-3 py-1.5 font-medium">Class</th>
                      <th className="w-44 px-3 py-1.5 font-medium">
                        Instructor
                      </th>
                      <th className="w-32 px-3 py-1.5 font-medium">Room</th>
                      <th className="w-16 px-3 py-1.5 text-right font-medium">
                        Cap
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {daySessions.map((s) => (
                      <tr
                        key={s.id}
                        className={s.is_public ? "" : "text-gray-500"}
                      >
                        <td className="px-3 py-1.5 tabular-nums">
                          {formatTime(s.start_time)}
                          {s.end_time
                            ? ` – ${formatTime(s.end_time)}`
                            : null}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="font-medium">
                            {(s.title && s.title.trim()) ||
                              s.class_templates?.name ||
                              "Class"}
                          </span>
                          {!s.is_public && (
                            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-500">
                              Private
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {s.instructors?.full_name || "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          {s.rooms?.name || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">
                          {s.capacity ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[10px] uppercase tracking-wider text-gray-400">
        Generated from Klasly · {studioName}
      </p>
    </div>
  );
}

// ---------- helpers ----------

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // Sunday-based week (matches the calendar view).
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatYMD(d: Date): string {
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

function formatTime(t: string): string {
  // Expected format "HH:MM:SS" or "HH:MM"
  const [hh = "0", mm = "00"] = t.split(":");
  let h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${mm} ${ampm}`;
}

function PreviousWeekLink({ weekStart }: { weekStart: Date }) {
  const prev = addDays(weekStart, -7);
  return (
    <Link
      href={`/calendar/print?week=${formatYMD(prev)}&auto=false`}
      className="btn-secondary"
    >
      ← Previous week
    </Link>
  );
}

function NextWeekLink({ weekStart }: { weekStart: Date }) {
  const next = addDays(weekStart, 7);
  return (
    <Link
      href={`/calendar/print?week=${formatYMD(next)}&auto=false`}
      className="btn-secondary"
    >
      Next week →
    </Link>
  );
}
