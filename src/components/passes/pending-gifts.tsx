"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Gift = {
  id: string;
  studio_pass_id: string;
  class_count: number;
  message: string | null;
  studio_passes?: { name?: string } | { name?: string }[] | null;
};

/**
 * Recipient widget — surfaces pending gifts at the top of my-passes
 * so the member can redeem with one click.
 */
export default function PendingGifts() {
  const router = useRouter();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchGifts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/member/pass-gift");
    setLoading(false);
    if (!res.ok) return;
    setGifts(await res.json());
  }, []);

  useEffect(() => {
    fetchGifts();
  }, [fetchGifts]);

  async function redeem(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/member/pass-gift", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId: id, action: "redeem" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to redeem");
        return;
      }
      await fetchGifts();
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (loading || gifts.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="text-sm font-semibold text-emerald-900">
        Pending gifts ({gifts.length})
      </h3>
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
      <ul className="mt-3 space-y-2">
        {gifts.map((g) => {
          const pass = Array.isArray(g.studio_passes)
            ? g.studio_passes[0]
            : g.studio_passes;
          return (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white px-3 py-2 shadow-sm"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {g.class_count} class{g.class_count === 1 ? "" : "es"} —{" "}
                  {pass?.name || "Pass"}
                </p>
                {g.message && (
                  <p className="text-xs italic text-gray-500">
                    &ldquo;{g.message}&rdquo;
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => redeem(g.id)}
                disabled={busyId === g.id}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busyId === g.id ? "Claiming…" : "Claim"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
