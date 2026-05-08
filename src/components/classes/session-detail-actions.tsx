"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SessionEditModal from "./session-edit-modal";

type Props = {
  session: {
    id: string;
    session_date: string;
    start_time: string;
    end_time: string | null;
    title?: string | null;
    instructor_id?: string | null;
    recurrence_group_id?: string | null;
  };
  isCancelled: boolean;
};

export default function SessionDetailActions({ session, isCancelled }: Props) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      const payload: Record<string, unknown> = {};
      if (cancelReason.trim()) payload.reason = cancelReason.trim();
      if (!notifyMembers) payload.notify_members = false;
      const hasBody = Object.keys(payload).length > 0;
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "DELETE",
        headers: hasBody ? { "Content-Type": "application/json" } : undefined,
        body: hasBody ? JSON.stringify(payload) : undefined,
      });
      if (res.ok) {
        router.refresh();
        setShowCancel(false);
      }
    } catch {
      // ignore
    } finally {
      setCancelling(false);
    }
  }

  if (isCancelled) {
    return (
      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-600/20 ring-inset">
        Cancelled
      </span>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowEdit(true)}
          className="btn-secondary text-sm whitespace-nowrap"
        >
          Edit session
        </button>
        <button
          onClick={() => setShowCancel(true)}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition whitespace-nowrap"
        >
          Cancel session
        </button>
      </div>

      {showEdit && (
        <SessionEditModal
          session={session}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            router.refresh();
          }}
        />
      )}

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Cancel session</h3>
            <p className="mt-1 text-sm text-gray-500">
              This will cancel the session and refund any credits/passes to confirmed members.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Instructor unavailable"
                  className="input-field mt-1"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={notifyMembers}
                  onChange={(e) => setNotifyMembers(e.target.checked)}
                  className="rounded accent-brand-600"
                />
                Notify members via email
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancel(false);
                  setCancelReason("");
                  setNotifyMembers(true);
                }}
                className="btn-secondary text-sm"
              >
                Keep session
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                {cancelling ? "Cancelling..." : "Cancel session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
