"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

  useEffect(() => {
    async function fetchClasses() {
      try {
        const res = await fetch("/api/instructor/classes");
        if (res.ok) {
          const data = await res.json();
          setClasses(data);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchClasses();
  }, []);

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
            <div
              key={cls.id}
              className="card flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                  {!cls.is_public && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      Private
                    </span>
                  )}
                  {!cls.is_active && (
                    <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-500">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {DAY_LABELS[cls.day_of_week]} &middot;{" "}
                  {formatTime(cls.start_time)} &middot; {cls.duration_minutes}{" "}
                  min &middot; Cap: {cls.capacity}
                  {cls.rooms ? ` · ${cls.rooms.name}` : ""}
                </p>
              </div>
              <div className="text-right">
                {cls.price_cents != null ? (
                  <span className="text-lg font-semibold text-gray-900">
                    ${(cls.price_cents / 100).toFixed(2)}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">No price set</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
