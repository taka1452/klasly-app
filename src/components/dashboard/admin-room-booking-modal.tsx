"use client";

import { useEffect, useRef, useState } from "react";

type Room = { id: string; name: string; capacity: number | null };
type Instructor = { id: string; fullName: string; email: string };

type ActivePass = {
  subscriptionId: string;
  used: number;
  max: number | null;
};

type MemberHit = {
  id: string;
  full_name: string;
  email: string;
  credits: number;
  active_pass: ActivePass | null;
};

/** Short label for the pass badge — `8 left`, `Unlimited`, or null when no pass. */
function passBadgeLabel(pass: ActivePass | null): string | null {
  if (!pass) return null;
  if (pass.max === null) return "Unlimited";
  return `${Math.max(0, pass.max - pass.used)} left`;
}

type Props = {
  rooms: Room[];
  instructors: Instructor[];
  onClose: () => void;
  onCreated: () => void;
};

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminRoomBookingModal({
  rooms,
  instructors,
  onClose,
  onCreated,
}: Props) {
  const [roomId, setRoomId] = useState(rooms[0]?.id || "");
  const [instructorId, setInstructorId] = useState(instructors[0]?.id || "");
  const [title, setTitle] = useState("");
  const [bookingDate, setBookingDate] = useState(todayLocal());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isPublic, setIsPublic] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client (member) attachment
  const [memberQuery, setMemberQuery] = useState("");
  const [memberHits, setMemberHits] = useState<MemberHit[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberHit | null>(null);
  const [usePass, setUsePass] = useState(true);
  const [showHits, setShowHits] = useState(false);
  const memberSearchTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced typeahead
  useEffect(() => {
    if (selectedMember) return; // don't search while a pick is locked in
    if (!showHits) return;
    if (memberSearchTimer.current) clearTimeout(memberSearchTimer.current);
    memberSearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/dashboard/members-search?q=${encodeURIComponent(memberQuery)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setMemberHits(data.members ?? []);
      } catch {
        // ignore
      }
    }, 200);
    return () => {
      if (memberSearchTimer.current) clearTimeout(memberSearchTimer.current);
    };
  }, [memberQuery, showHits, selectedMember]);

  function pickMember(m: MemberHit) {
    setSelectedMember(m);
    setMemberQuery(m.full_name);
    setShowHits(false);
    if (!m.active_pass) setUsePass(false);
  }

  function clearMember() {
    setSelectedMember(null);
    setMemberQuery("");
    setUsePass(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/rooms/admin-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_id: roomId,
        instructor_id: instructorId,
        title: title.trim(),
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        is_public: isPublic,
        notes: notes.trim() || undefined,
        member_id: selectedMember?.id ?? null,
        use_pass:
          !!selectedMember && !!selectedMember.active_pass && usePass,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create booking");
      return;
    }

    onCreated();
  }

  const passInfo = selectedMember?.active_pass ?? null;
  // Phrase shown on the selected-member card. "8 sessions remaining" /
  // "1 session remaining" / "Unlimited sessions". Null when there's no pass.
  const passRemainingLabel = (() => {
    if (!passInfo) return null;
    if (passInfo.max === null) return "Unlimited sessions";
    const left = Math.max(0, passInfo.max - passInfo.used);
    return `${left} session${left === 1 ? "" : "s"} remaining`;
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add room booking</h2>
            <p className="mt-1 text-xs text-gray-500">
              Book a room on behalf of an instructor (private session, workshop prep, guest teacher).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Instructor
            </label>
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              required
              className="input-field w-full"
            >
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.fullName} {i.email ? `(${i.email})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Room
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
              className="input-field w-full"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.capacity ? ` (capacity ${r.capacity})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Body Therapy with Geri"
              className="input-field w-full"
            />
          </div>

          {/* Client (member) — optional, with pass deduction */}
          <div className="relative">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Client (optional)
            </label>
            {selectedMember ? (
              <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium text-gray-900">
                    {selectedMember.full_name}
                  </div>
                  {selectedMember.email && (
                    <div className="text-xs text-gray-500">
                      {selectedMember.email}
                    </div>
                  )}
                  {passRemainingLabel ? (
                    <div className="mt-0.5 text-xs text-teal-700">
                      Active pass · {passRemainingLabel}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-xs text-gray-500">
                      No active pass
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={clearMember}
                  className="text-xs text-gray-400 transition-colors duration-150 hover:text-gray-700 active:text-gray-900"
                >
                  Change
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={memberQuery}
                onFocus={() => setShowHits(true)}
                onChange={(e) => {
                  setMemberQuery(e.target.value);
                  setShowHits(true);
                }}
                placeholder="Search by name or email…"
                className="input-field w-full"
                autoComplete="off"
              />
            )}
            {showHits && !selectedMember && (
              <div
                className="popover-in absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
                style={{ ["--popover-origin" as string]: "top" }}
              >
                {memberHits.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-500">
                    {memberQuery.trim()
                      ? `No members match "${memberQuery.trim()}".`
                      : "Start typing to search members."}
                  </p>
                ) : (
                  memberHits.map((m) => {
                    const passLabel = passBadgeLabel(m.active_pass);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => pickMember(m)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-gray-50 active:bg-gray-100"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-medium text-gray-900">
                            {m.full_name}
                          </span>
                          {m.email && (
                            <span className="ml-2 text-xs text-gray-500">
                              {m.email}
                            </span>
                          )}
                        </span>
                        {passLabel ? (
                          <span className="shrink-0 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700">
                            {passLabel}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] text-gray-400">
                            no pass
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
            {selectedMember && passInfo && (
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={usePass}
                  onChange={(e) => setUsePass(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Deduct one session from this client&apos;s pass
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Date
              </label>
              <input
                type="date"
                value={bookingDate}
                min={todayLocal()}
                onChange={(e) => setBookingDate(e.target.value)}
                required
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
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
                required
                className="input-field w-full"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Visible to the instructor on their calendar."
              className="input-field w-full"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Show on the public calendar
          </label>

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
              {loading ? "Booking..." : "Create booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
