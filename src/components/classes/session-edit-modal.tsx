"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

type Session = {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string | null;
  title?: string | null;
  instructor_id?: string | null;
  recurrence_group_id?: string | null;
};

type Scope = "single" | "future" | "all";

type ScopeImpact = {
  recurring: boolean;
  future: { sessions: number; bookings: number };
  all: { sessions: number; bookings: number };
};

type InstructorOption = {
  id: string;
  name: string;
};

type Props = {
  session: Session;
  onClose: () => void;
  onSaved: (updated: {
    session_date: string;
    start_time: string;
    end_time: string;
    title?: string | null;
    instructor_id: string | null;
    scope: Scope;
    updated_count: number;
  }) => void;
};

/**
 * Single-session edit modal. Lets owners/managers change an individual
 * class session's date, start time, end time and title without having to
 * cancel it and schedule a new one.
 *
 * Jamie feedback 2026-04: "I added a class... but accidentally put the wrong
 * day of the week. Right now, my only option is to cancel every session and
 * then re-add the correct day."
 *
 * Jamie feedback 2026-04-28 ("Editing error"): native HTML5 `required`
 * combined with a possibly-empty `end_time` produced a persistent
 * "Invalid value" tooltip from the browser even when the entered time was
 * fine. We now drop `required`, default a missing `end_time` to start+60m,
 * and surface our own validation errors inline.
 */
export default function SessionEditModal({ session, onClose, onSaved }: Props) {
  // Always normalise to HH:MM (5 chars) so <input type="time"> always
  // receives a value its UI can render — never an empty string mid-edit.
  const initialStart = useMemo(
    () => session.start_time.slice(0, 5),
    [session.start_time]
  );
  const initialEnd = useMemo(
    () => normaliseEnd(session.end_time, initialStart),
    [session.end_time, initialStart]
  );

  const [sessionDate, setSessionDate] = useState(session.session_date);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [title, setTitle] = useState(session.title || "");
  const [instructorId, setInstructorId] = useState<string>(
    session.instructor_id ?? ""
  );
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [scope, setScope] = useState<Scope>("single");
  const [impact, setImpact] = useState<ScopeImpact | null>(null);
  // When the instructor changes we default to notifying confirmed members
  // by email. Owners can uncheck it for invisible swaps (e.g. data fixes).
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRecurring = Boolean(session.recurrence_group_id);
  const dateChanged = sessionDate !== session.session_date;
  const seriesScope = scope !== "single";
  const instructorChanged =
    (instructorId || null) !== (session.instructor_id ?? null);
  const timeChanged =
    startTime !== session.start_time.slice(0, 5);
  // Members-visible change = anything they'd notice on their booking. The
  // toggle below only renders for one of these so silent edits (title,
  // end-time-only) don't bother members.
  const memberVisibleChange = dateChanged || timeChanged || instructorChanged;

  useEffect(() => {
    const start = session.start_time.slice(0, 5);
    setSessionDate(session.session_date);
    setStartTime(start);
    setEndTime(normaliseEnd(session.end_time, start));
    setTitle(session.title || "");
    setInstructorId(session.instructor_id ?? "");
    setScope("single");
    setImpact(null);
    setNotifyMembers(true);
    setError(null);
  }, [session]);

  // Load the studio's active instructors so the picker is populated.
  // Read-only — the API already enforces owner / manager / instructor scoping.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/instructors");
        if (!res.ok) return;
        const data = (await res.json()) as InstructorOption[];
        if (!cancelled) setInstructors(data);
      } catch {
        // ignore — modal still works without the picker
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch how many sessions / active bookings would be affected by future
  // and all scopes, so the radio labels can preview the blast radius before
  // the user commits. Informational only — failures are silent.
  useEffect(() => {
    if (!isRecurring) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/sessions/${session.id}?action=scope-impact`
        );
        if (!res.ok) return;
        const data = (await res.json()) as ScopeImpact;
        if (!cancelled) setImpact(data);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.id, isRecurring]);

  // Auto-shift end-time when start-time moves forward past the current end.
  // Mirrors Google Calendar behaviour: keeps the duration sensible without
  // forcing the user to retype the end.
  function handleStartChange(next: string) {
    setStartTime(next);
    if (next && endTime && toMinutes(next) >= toMinutes(endTime)) {
      setEndTime(addMinutesHHMM(next, 60));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!sessionDate) {
      setError("Date is required");
      return;
    }
    if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
      setError("Start time is required");
      return;
    }
    if (!endTime || !/^\d{2}:\d{2}$/.test(endTime)) {
      setError("End time is required");
      return;
    }
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      setError("End time must be after start time");
      return;
    }

    setLoading(true);

    const normalisedInstructorId = instructorId || null;

    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_date: sessionDate,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        title: title.trim() || null,
        // Only send instructor_id when it actually changed so the API doesn't
        // re-write the column unnecessarily on every save.
        ...(instructorChanged
          ? { instructor_id: normalisedInstructorId }
          : {}),
        // Caller-visible notification opt-in/out applies to instructor /
        // time / date changes alike. The API ignores it for end-time-only
        // edits because those don't fire a member email anyway.
        notify_members: memberVisibleChange ? notifyMembers : false,
        scope,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update session");
      return;
    }

    const data = (await res.json().catch(() => ({}))) as {
      updated_count?: number;
    };

    onSaved({
      session_date: sessionDate,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      title: title.trim() || null,
      instructor_id: normalisedInstructorId,
      scope,
      updated_count: data.updated_count ?? 1,
    });
  }

  return (
    <div
      className="modal-backdrop-enter fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="modal-dialog-enter w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit session</h2>
            <p className="mt-1 text-xs text-gray-500">
              {isRecurring
                ? "Pick which sessions in the series this change applies to."
                : "Change this single session’s date and time."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-m-2 rounded-md p-2 text-gray-400 transition-[color,transform] duration-150 ease-out hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 active:scale-[0.97]"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {error && (
          <div className="panel-enter mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Date
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="input-field w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => handleStartChange(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                End
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Instructor
            </label>
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              className="input-field w-full"
              aria-label="Instructor"
            >
              <option value="">— Unassigned —</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            {instructorChanged && (
              <p className="mt-1 text-[11px] text-brand-700">
                Substituting instructor.
                {seriesScope ? " Applies to the chosen scope." : ""}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Title (optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Leave blank to use the class name"
              className="input-field w-full"
            />
          </div>

          {isRecurring && (
            <fieldset
              className="panel-enter rounded-lg border border-gray-200 bg-gray-50/60 p-3"
              aria-label="Apply changes to"
            >
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
                Apply to
              </legend>
              <div className="space-y-1.5">
                <ScopeRadio
                  value="single"
                  current={scope}
                  onChange={setScope}
                  label="This session only"
                  hint="Other sessions in the series stay as they are."
                />
                <ScopeRadio
                  value="future"
                  current={scope}
                  onChange={setScope}
                  label="This and following"
                  hint={impactHint(impact?.future)}
                />
                <ScopeRadio
                  value="all"
                  current={scope}
                  onChange={setScope}
                  label="All sessions in the series"
                  hint={impactHint(impact?.all)}
                />
              </div>
              {seriesScope && dateChanged && (
                <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                  Date change applies only to this session. Time and title
                  changes will fan out across {scope === "all" ? "all" : "future"} sessions.
                </p>
              )}
            </fieldset>
          )}

          {memberVisibleChange && (
            <label className="flex items-start gap-2 rounded-md bg-gray-50 px-2.5 py-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={notifyMembers}
                onChange={(e) => setNotifyMembers(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20"
              />
              <span>
                Email confirmed members about{" "}
                {instructorChanged
                  ? "the instructor change"
                  : dateChanged
                    ? "the new date"
                    : "the new time"}
                . Uncheck for silent fixes.
              </span>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              <span className="label-swap" data-pending={loading}>
                {loading ? "Saving..." : saveLabel(scope, impact)}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- helpers ---

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function addMinutesHHMM(hhmm: string, minutes: number): string {
  const total = toMinutes(hhmm) + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`;
}

/**
 * Normalise an end-time coming from the DB. If it's null, empty, or not a
 * valid HH:MM, default to start+60m so the time picker never opens with a
 * blank value (which is what triggered the browser's "Invalid value"
 * tooltip in Jamie's feedback).
 */
function normaliseEnd(rawEnd: string | null, start: string): string {
  const candidate = (rawEnd || "").slice(0, 5);
  if (/^\d{2}:\d{2}$/.test(candidate)) return candidate;
  if (/^\d{2}:\d{2}$/.test(start)) return addMinutesHHMM(start, 60);
  return "";
}

function impactHint(
  s: { sessions: number; bookings: number } | undefined
): string {
  if (!s) return "";
  const sessionsPart =
    s.sessions === 1 ? "1 session" : `${s.sessions} sessions`;
  const bookingsPart =
    s.bookings === 0
      ? "no bookings"
      : s.bookings === 1
        ? "1 booking"
        : `${s.bookings} bookings`;
  return `Affects ${sessionsPart}, ${bookingsPart}.`;
}

function saveLabel(scope: Scope, impact: ScopeImpact | null): string {
  if (scope === "single") return "Save changes";
  const target = scope === "future" ? impact?.future : impact?.all;
  if (!target) return "Save changes";
  return `Apply to ${target.sessions} sessions`;
}

function ScopeRadio(props: {
  value: Scope;
  current: Scope;
  onChange: (s: Scope) => void;
  label: string;
  hint: string;
}) {
  const { value, current, onChange, label, hint } = props;
  const checked = current === value;
  return (
    <label
      className={`flex min-h-[44px] cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors duration-150 ${
        checked
          ? "border-gray-900 bg-white shadow-sm"
          : "border-transparent hover:border-gray-300 hover:bg-white/60"
      }`}
    >
      <input
        type="radio"
        name="session-edit-scope"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-0.5 h-4 w-4 accent-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/40 focus-visible:ring-offset-1"
      />
      <span className="flex-1">
        <span className="block font-medium text-gray-900">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[11px] text-gray-500">{hint}</span>
        )}
      </span>
    </label>
  );
}
