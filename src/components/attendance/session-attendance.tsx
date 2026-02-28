"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatTime, getPlanLabel } from "@/lib/utils";

type BookedItem = {
  booking_id: string;
  member_id: string;
  member_name: string;
  plan_type: string;
  credits: number;
  attended: boolean;
  credit_deducted: boolean;
};

type DropInItem = {
  drop_in_id: string;
  member_id: string;
  member_name: string;
  plan_type: string;
  credits: number;
  attended_at: string;
  credit_deducted: boolean;
};

type SessionData = {
  session: {
    id: string;
    class_id: string;
    class_name: string;
    session_date: string;
    start_time: string;
    capacity: number;
  };
  booked: BookedItem[];
  drop_ins: DropInItem[];
  summary: {
    total_booked: number;
    booked_attended: number;
    drop_in_attended: number;
    total_attended: number;
  };
};

type MemberOption = {
  id: string;
  full_name: string;
  plan_type: string;
  credits: number;
};

export default function SessionAttendance({
  classId,
  sessionId,
  initialClassName,
  initialSessionDate,
  initialStartTime,
  initialCapacity,
}: {
  classId: string;
  sessionId: string;
  initialClassName: string;
  initialSessionDate: string;
  initialStartTime: string;
  initialCapacity: number;
}) {
  const router = useRouter();
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/attendance/session/${sessionId}`);
    if (!res.ok) {
      setError("Failed to load attendance data");
      return;
    }
    const json = await res.json();
    setData(json);
    setError(null);
  }, [sessionId]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const handleToggle = async (bookingId: string, currentAttended: boolean) => {
    const newValue = !currentAttended;
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        booked: prev.booked.map((b) =>
          b.booking_id === bookingId ? { ...b, attended: newValue } : b
        ),
        summary: {
          ...prev.summary,
          booked_attended: prev.summary.booked_attended + (newValue ? 1 : -1),
          total_attended:
            prev.summary.total_attended + (newValue ? 1 : -1),
        },
      };
    });

    const res = await fetch("/api/attendance/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId, attended: newValue }),
    });

    if (!res.ok) {
      const err = await res.json();
      fetchData();
      alert(err.error || "Failed to update");
    }
    router.refresh();
  };

  const handleDeduct = async (
    memberId: string,
    bookingId?: string,
    dropInId?: string
  ) => {
    const res = await fetch("/api/attendance/deduct-credit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: memberId,
        booking_id: bookingId,
        drop_in_id: dropInId,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to deduct");
      return;
    }
    await fetchData();
    router.refresh();
  };

  const handleUndoDeduct = async (
    memberId: string,
    bookingId?: string,
    dropInId?: string
  ) => {
    const res = await fetch("/api/attendance/undo-deduct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: memberId,
        booking_id: bookingId,
        drop_in_id: dropInId,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to undo");
      return;
    }
    await fetchData();
    router.refresh();
  };

  const handleRemoveDropIn = async (dropInId: string, memberName: string) => {
    const hasRefund = data?.drop_ins.find(
      (d) => d.drop_in_id === dropInId && d.credit_deducted
    );
    const msg = hasRefund
      ? `Remove ${memberName} from this session? This will also refund 1 credit.`
      : `Remove ${memberName} from this session?`;
    if (!confirm(msg)) return;

    const res = await fetch("/api/attendance/drop-in", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drop_in_id: dropInId }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to remove");
      return;
    }
    await fetchData();
    router.refresh();
  };

  if (loading) {
    return (
      <div className="card py-12 text-center text-sm text-gray-500">
        Loading attendance...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card py-12 text-center text-sm text-red-600">
        {error || "Failed to load data"}
      </div>
    );
  }

  const summary = data.summary;

  return (
    <div className="space-y-6">
      <div className="card">
        <p className="text-sm text-gray-600">
          {summary.booked_attended} / {summary.total_booked} booked attended ·{" "}
          {summary.drop_in_attended} drop-ins · {summary.total_attended} total
        </p>
      </div>

      {/* Booked Members */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-500">Booked Members</h3>
        {data.booked.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Credits</th>
                  <th className="pb-2 font-medium">Attended</th>
                  <th className="pb-2 font-medium">Credit</th>
                </tr>
              </thead>
              <tbody>
                {data.booked.map((b) => (
                  <tr key={b.booking_id} className="border-b border-gray-100">
                    <td className="py-3 font-medium text-gray-900">
                      {b.member_name}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          b.plan_type === "monthly"
                            ? "bg-blue-100 text-blue-800"
                            : b.plan_type === "pack"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {getPlanLabel(b.plan_type)}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {b.credits === -1 ? "∞" : b.credits}
                    </td>
                    <td className="py-3">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={b.attended}
                          onChange={() => handleToggle(b.booking_id, b.attended)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                      </label>
                    </td>
                    <td className="py-3">
                      {!b.attended ? (
                        <span className="text-gray-400">—</span>
                      ) : b.plan_type === "monthly" ? (
                        <span className="text-gray-400">—</span>
                      ) : b.credit_deducted ? (
                        <span className="flex items-center gap-2 text-sm">
                          <span className="text-green-600">✓ Deducted</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUndoDeduct(b.member_id, b.booking_id)
                            }
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Undo
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleDeduct(b.member_id, b.booking_id)
                          }
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Deduct
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">No bookings for this session.</p>
        )}
      </div>

      {/* Drop-in Attendees */}
      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500">
            Drop-in Attendees
          </h3>
          <AddDropInButton
            sessionId={sessionId}
            onAdded={() => {
              fetchData();
              router.refresh();
            }}
            excludedIds={[
              ...data.booked.map((b) => b.member_id),
              ...data.drop_ins.map((d) => d.member_id),
            ]}
          />
        </div>
        {data.drop_ins.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Credits</th>
                  <th className="pb-2 font-medium">Credit</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.drop_ins.map((d) => (
                  <tr key={d.drop_in_id} className="border-b border-gray-100">
                    <td className="py-3 font-medium text-gray-900">
                      {d.member_name}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          d.plan_type === "monthly"
                            ? "bg-blue-100 text-blue-800"
                            : d.plan_type === "pack"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {getPlanLabel(d.plan_type)}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {d.credits === -1 ? "∞" : d.credits}
                    </td>
                    <td className="py-3">
                      {d.plan_type === "monthly" ? (
                        <span className="text-gray-400">—</span>
                      ) : d.credit_deducted ? (
                        <span className="flex items-center gap-2 text-sm">
                          <span className="text-green-600">✓ Deducted</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUndoDeduct(d.member_id, undefined, d.drop_in_id)
                            }
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Undo
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleDeduct(d.member_id, undefined, d.drop_in_id)
                          }
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Deduct
                        </button>
                      )}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveDropIn(d.drop_in_id, d.member_name)
                        }
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">
            No drop-in attendees. Click &quot;+ Add Drop-in&quot; to add.
          </p>
        )}
      </div>
    </div>
  );
}

function AddDropInButton({
  sessionId,
  onAdded,
  excludedIds,
}: {
  sessionId: string;
  onAdded: () => void;
  excludedIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(
        `/api/attendance/members-for-dropin?session_id=${encodeURIComponent(sessionId)}&q=${encodeURIComponent(query)}`
      )
        .then((r) => r.json())
        .then((d) => setMembers(d.members || []))
        .catch(() => setMembers([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [open, sessionId, query]);

  const handleSelect = async (member: MemberOption) => {
    setAdding(member.id);
    const res = await fetch("/api/attendance/drop-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, member_id: member.id }),
    });
    setAdding(null);
    if (res.ok) {
      setOpen(false);
      setQuery("");
      onAdded();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to add");
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-sm text-blue-600 hover:text-blue-800"
      >
        + Add Drop-in
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
            <input
              type="text"
              placeholder="Search members..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              autoFocus
            />
            <div className="mt-2 max-h-48 overflow-y-auto">
              {loading ? (
                <p className="py-4 text-center text-sm text-gray-500">
                  Searching...
                </p>
              ) : members.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">
                  No members available
                </p>
              ) : (
                members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelect(m)}
                    disabled={adding === m.id}
                    className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="font-medium">{m.full_name}</span>
                    <span className="text-xs text-gray-500">
                      {getPlanLabel(m.plan_type)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
