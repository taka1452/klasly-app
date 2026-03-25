"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatTime, formatDuration } from "@/lib/utils";
import InstructorClassEditForm from "@/components/instructor/instructor-class-edit-form";
import Toast from "@/components/ui/toast";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type ClassDetail = {
  id: string;
  name: string;
  description: string | null;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  is_active: boolean;
  is_public: boolean;
  is_online: boolean;
  online_link: string | null;
  price_cents: number | null;
  room_id: string | null;
  rooms: { name: string } | null;
};

type SessionInfo = {
  id: string;
  session_date: string;
  is_cancelled: boolean;
  bookedCount: number;
};

type RoomOption = { id: string; name: string };

export default function InstructorClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;

  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; variant: "success" | "error" } | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchClass = useCallback(async () => {
    try {
      const res = await fetch("/api/instructor/classes");
      if (!res.ok) return;
      const classes = await res.json();
      const found = (classes as ClassDetail[]).find((c) => c.id === classId);
      if (found) setCls(found);
    } catch {
      // handled by loading state
    }
  }, [classId]);

  const fetchSessions = useCallback(async () => {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const { data: sessionRows } = await supabase
      .from("class_sessions")
      .select("id, session_date, is_cancelled")
      .eq("class_id", classId)
      .gte("session_date", today)
      .order("session_date", { ascending: true })
      .limit(8);

    if (!sessionRows || sessionRows.length === 0) {
      setSessions([]);
      return;
    }

    const sessionIds = sessionRows.map((s) => s.id);
    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("session_id")
      .in("session_id", sessionIds)
      .eq("status", "confirmed");

    const countMap: Record<string, number> = {};
    (bookingRows || []).forEach((b) => {
      countMap[b.session_id] = (countMap[b.session_id] || 0) + 1;
    });

    setSessions(
      sessionRows.map((s) => ({
        id: s.id,
        session_date: s.session_date,
        is_cancelled: s.is_cancelled,
        bookedCount: countMap[s.id] || 0,
      }))
    );
  }, [classId]);

  const fetchRooms = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user?.id)
      .single();
    if (!profile?.studio_id) return;
    const { data } = await supabase
      .from("rooms")
      .select("id, name")
      .eq("studio_id", profile.studio_id)
      .eq("is_active", true)
      .order("name", { ascending: true });
    setRooms(data || []);
  }, []);

  useEffect(() => {
    Promise.all([fetchClass(), fetchSessions(), fetchRooms()]).finally(() =>
      setLoading(false)
    );
  }, [fetchClass, fetchSessions, fetchRooms]);

  async function handleToggleActive() {
    if (!cls) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/instructor/classes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cls.id, is_active: !cls.is_active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToastMessage({ text: data.error ?? "Failed to update", variant: "error" });
        return;
      }
      setCls({ ...cls, is_active: !cls.is_active });
      setToastMessage({ text: cls.is_active ? "Class deactivated" : "Class activated", variant: "success" });
      setConfirmDeactivate(false);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!cls) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/instructor/classes?id=${cls.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToastMessage({ text: data.error ?? "Failed to delete", variant: "error" });
        setConfirmDelete(false);
        return;
      }
      router.push("/instructor/classes");
      router.refresh();
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Link href="/instructor/classes" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          &larr; Back to My Classes
        </Link>
        <div className="mt-6 card py-12 text-center text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!cls) {
    return (
      <div>
        <Link href="/instructor/classes" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          &larr; Back to My Classes
        </Link>
        <div className="mt-6 card py-12 text-center text-sm text-red-600">Class not found</div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/instructor/classes" className="text-sm font-medium text-brand-600 hover:text-brand-700">
        &larr; Back to My Classes
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{cls.name}</h1>
        {cls.is_active ? (
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Active</span>
        ) : (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Inactive</span>
        )}
        {!cls.is_public && (
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Private</span>
        )}
        {cls.is_online && (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">Online</span>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left: Edit Form */}
        <div className="lg:col-span-2">
          <InstructorClassEditForm
            classId={cls.id}
            initialData={{
              name: cls.name,
              description: cls.description ?? "",
              dayOfWeek: cls.day_of_week,
              startTime: cls.start_time.slice(0, 5),
              durationMinutes: cls.duration_minutes,
              capacity: cls.capacity,
              roomId: cls.room_id ?? "",
              isPublic: cls.is_public,
              isOnline: cls.is_online,
              onlineLink: cls.online_link ?? "",
              priceCents: cls.price_cents,
            }}
            rooms={rooms}
            onSaved={() => {
              fetchClass();
              fetchSessions();
            }}
          />
        </div>

        {/* Right: Info panels */}
        <div className="space-y-6">
          {/* Schedule info */}
          <div className="card">
            <h3 className="font-semibold text-gray-900">Schedule</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Day</dt>
                <dd className="font-medium text-gray-900">{DAY_LABELS[cls.day_of_week]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Time</dt>
                <dd className="font-medium text-gray-900">{formatTime(cls.start_time)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Duration</dt>
                <dd className="font-medium text-gray-900">{formatDuration(cls.duration_minutes)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Capacity</dt>
                <dd className="font-medium text-gray-900">{cls.capacity}</dd>
              </div>
              {cls.rooms && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Room</dt>
                  <dd className="font-medium text-gray-900">{cls.rooms.name}</dd>
                </div>
              )}
              {cls.price_cents != null && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Price</dt>
                  <dd className="font-medium text-gray-900">${(cls.price_cents / 100).toFixed(2)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Upcoming sessions */}
          <div className="card">
            <h3 className="font-semibold text-gray-900">Upcoming Sessions</h3>
            {sessions.length > 0 ? (
              <div className="mt-3 divide-y divide-gray-100">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <span className={s.is_cancelled ? "text-gray-400 line-through" : "text-gray-700"}>
                      {formatDate(s.session_date)}
                    </span>
                    <span className="text-gray-500">
                      {s.is_cancelled ? "Cancelled" : `${s.bookedCount}/${cls.capacity} booked`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500">No upcoming sessions.</p>
            )}
          </div>

          {/* Danger zone */}
          <div className="card border-red-200">
            <h3 className="font-semibold text-red-600">Danger Zone</h3>

            {/* Deactivate / Activate */}
            <div className="mt-4">
              {confirmDeactivate ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    {cls.is_active
                      ? "Deactivating will hide this class from member schedules."
                      : "Reactivating will make this class visible again."}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleToggleActive}
                      disabled={actionLoading}
                      className="btn-danger text-sm"
                    >
                      {actionLoading ? "..." : cls.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => setConfirmDeactivate(false)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeactivate(true)}
                  className={`text-sm font-medium ${cls.is_active ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700"}`}
                >
                  {cls.is_active ? "Deactivate class" : "Reactivate class"}
                </button>
              )}
            </div>

            {/* Delete */}
            <div className="mt-4 border-t border-red-100 pt-4">
              {confirmDelete ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-600">
                    This will permanently delete the class and its future sessions. This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={actionLoading}
                      className="btn-danger text-sm"
                    >
                      {actionLoading ? "Deleting..." : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Delete class
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage.text}
          variant={toastMessage.variant}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
