"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/api/csrf-client";

/**
 * Inline owner card offering to drop a small set of sample members and
 * classes into the studio for trial-period exploration. Hidden once the
 * studio already has any non-sample data, so it doesn't linger after
 * real members start joining.
 */
export default function SampleDataInvite() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await csrfFetch("/api/dev/seed-sample-data", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(
          (data?.errors && Array.isArray(data.errors) && data.errors[0]) ||
            data?.error ||
            "Couldn't add sample data — please try again.",
        );
        return;
      }
      setDone(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <section
        aria-label="Sample data added"
        className="mb-8 rounded-xl border border-emerald-100 bg-emerald-50/50 px-6 py-5 md:px-7"
      >
        <p className="text-sm text-emerald-800">
          Sample members and classes added — explore the calendar, members
          list, or bookings to see how things hang together.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Try with sample data"
      className="mb-8 rounded-xl border border-gray-200 bg-white px-6 py-5 md:px-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-gray-900">
            Want to try it first?
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Add 5 sample members and 3 sample classes to explore. Remove them
            anytime — they&apos;re tagged{" "}
            <code className="rounded bg-gray-100 px-1 text-[12px]">[sample]</code>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {error && (
            <span className="text-xs text-red-600" role="alert">
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className="inline-flex items-center rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-300 hover:text-gray-900 disabled:opacity-60"
          >
            {loading ? "Adding…" : "Add sample data"}
          </button>
        </div>
      </div>
    </section>
  );
}
