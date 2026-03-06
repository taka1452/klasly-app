"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

type InstructorProfileData = {
  instructor: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    bio: string | null;
    specialties: string[];
    classes_count: number;
    created_at: string;
  };
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

type Props = {
  instructorId: string;
  open: boolean;
  onClose: () => void;
};

export default function InstructorProfileCard({
  instructorId,
  open,
  onClose,
}: Props) {
  const [data, setData] = useState<InstructorProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(() => {
    if (!instructorId || !open) return;
    setLoading(true);
    fetch(`/api/instructors/${instructorId}/profile`)
      .then((r) => r.json())
      .then((res) => {
        if (res.instructor) setData(res);
        else setData(null);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [instructorId, open]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="instructor-profile-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="instructor-profile-title"
            className="text-center text-lg font-semibold text-gray-900"
          >
            Instructor Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          </div>
        ) : data ? (
          <>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-100 text-lg font-semibold text-sky-700">
                {getInitials(data.instructor.full_name)}
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {data.instructor.full_name}
                </p>
                {data.instructor.specialties.length > 0 && (
                  <p className="text-sm text-gray-500">
                    {data.instructor.specialties.join(", ")}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-gray-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-brand-600">
                {data.instructor.classes_count}
              </p>
              <p className="text-xs text-gray-500">
                Classes assigned
              </p>
            </div>

            <dl className="mt-5 space-y-2 border-t border-gray-100 pt-4">
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">{data.instructor.email}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">
                  {data.instructor.phone || "—"}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Joined</dt>
                <dd className="font-medium text-gray-900">
                  {formatDate(data.instructor.created_at.split("T")[0])}
                </dd>
              </div>
            </dl>

            {data.instructor.bio && (
              <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-600">
                {data.instructor.bio}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <a
                href={`mailto:${data.instructor.email}`}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-700"
              >
                Send Message
              </a>
              <Link
                href={`/instructors/${data.instructor.id}`}
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Edit
              </Link>
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-red-600">
            Failed to load instructor profile.
          </p>
        )}
      </div>
    </>
  );
}
