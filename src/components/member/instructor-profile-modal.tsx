"use client";

import { useEffect, useState } from "react";

type InstructorData = {
  id: string;
  full_name: string;
  bio: string | null;
  specialties: string[];
};

type Props = {
  instructorId: string;
  onClose: () => void;
};

export default function InstructorProfileModal({
  instructorId,
  onClose,
}: Props) {
  const [data, setData] = useState<InstructorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/member/instructor/${instructorId}`);
        if (res.ok && !cancelled) {
          setData(await res.json());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [instructorId]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const initials = data?.full_name
    ? data.full_name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  return (
    <>
      {/* Backdrop — z-60 so it sits above popover (z-50) */}
      <div className="fixed inset-0 z-[60] bg-black/30" onClick={onClose} />

      {/* Modal — z-[61] above backdrop */}
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl pointer-events-auto"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            </div>
          ) : data ? (
            <div className="text-center">
              {/* Avatar */}
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">
                {initials}
              </div>

              <h3 className="mt-3 text-lg font-semibold text-gray-900">
                {data.full_name}
              </h3>

              {/* Specialties */}
              {data.specialties.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {data.specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Bio */}
              {data.bio ? (
                <p className="mt-4 text-sm leading-relaxed text-gray-600">
                  {data.bio}
                </p>
              ) : (
                <p className="mt-4 text-sm text-gray-400 italic">
                  No bio available
                </p>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">
              Could not load instructor profile.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
