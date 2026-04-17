"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDuration } from "@/lib/utils";

type InstructorClass = {
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
  price_cents: number | null;
  rooms: { name: string } | null;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function InstructorClassesPage() {
  const [classes, setClasses] = useState<InstructorClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", capacity: 0, price_cents: null as number | null });
  const [saving, setSaving] = useState(false);

  async function fetchClasses() {
    try {
      const res = await fetch("/api/instructor/classes");
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
        setError(null);
      } else {
        setError("Failed to load classes");
      }
    } catch {
      setError("Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchClasses(); }, []);

  function startEdit(cls: InstructorClass) {
    setEditingId(cls.id);
    setEditForm({
      name: cls.name,
      description: cls.description ?? "",
      capacity: cls.capacity,
      price_cents: cls.price_cents,
    });
  }

  async function handleSave(classId: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/instructor/classes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: classId, ...editForm }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchClasses();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(cls: InstructorClass) {
    const res = await fetch("/api/instructor/classes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cls.id, is_active: !cls.is_active }),
    });
    if (res.ok) await fetchClasses();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your classes and pricing
          </p>
        </div>
        <Link href="/instructor/classes/new" className="btn-primary">
          + New class
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {classes.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-500">
            You haven&apos;t created any classes yet.
          </p>
          <Link
            href="/instructor/classes/new"
            className="mt-3 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
          >
            Create your first class &rarr;
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((cls) => (
            <div key={cls.id} className="card">
              {editingId === cls.id ? (
                /* Inline edit form */
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="input-field w-full"
                    placeholder="Class name"
                  />
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="input-field w-full"
                    placeholder="Description (optional)"
                    rows={2}
                  />
                  <div className="flex gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Capacity</label>
                      <input
                        type="number"
                        min={1}
                        value={editForm.capacity}
                        onChange={(e) => setEditForm({ ...editForm, capacity: parseInt(e.target.value) || 1 })}
                        className="input-field w-24"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Price ($)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editForm.price_cents != null ? (editForm.price_cents / 100).toFixed(2) : ""}
                        onChange={(e) => setEditForm({ ...editForm, price_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
                        className="input-field w-28"
                        placeholder="No price"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSave(cls.id)} disabled={saving || !editForm.name.trim()} className="btn-primary text-sm">
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {cls.is_online && <span title="Online">📹 </span>}
                        <Link href={`/instructor/classes/${cls.id}`} className="hover:text-brand-600">
                          {cls.name}
                        </Link>
                      </h3>
                      {!cls.is_public && (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Private</span>
                      )}
                      {!cls.is_active && (
                        <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-500">Inactive</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {DAY_LABELS[cls.day_of_week]} &middot; {formatTime(cls.start_time)} &middot; {formatDuration(cls.duration_minutes)} &middot; Cap: {cls.capacity}
                      {cls.rooms ? ` · ${cls.rooms.name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {cls.price_cents != null ? (
                      <span className="text-lg font-semibold text-gray-900">${(cls.price_cents / 100).toFixed(2)}</span>
                    ) : (
                      <span className="text-sm text-gray-400">No price set</span>
                    )}
                    <button onClick={() => startEdit(cls)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-600" title="Edit">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleToggleActive(cls)}
                      className={`rounded-lg px-2 py-1 text-xs font-medium ${cls.is_active ? "text-red-600 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                      title={cls.is_active ? "Deactivate" : "Activate"}
                    >
                      {cls.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
