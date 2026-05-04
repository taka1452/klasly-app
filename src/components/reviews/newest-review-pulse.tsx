"use client";

import { useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "klasly:reviews:last-seen-id";
const PULSE_DURATION_MS = 1800;

/**
 * Wraps the topmost review row with a one-shot golden pulse the first
 * time the viewer sees a review they haven't seen before. After the
 * animation completes, the id is recorded in localStorage so the same
 * row doesn't keep flashing on every navigation.
 */
export function NewestReviewPulse({
  reviewId,
  children,
}: {
  reviewId: string;
  children: ReactNode;
}) {
  const [shouldPulse, setShouldPulse] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === reviewId) return;
    setShouldPulse(true);
    const t = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, reviewId);
    }, PULSE_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [reviewId]);

  if (!shouldPulse) return <>{children}</>;
  return <div className="review-pulse rounded-xl">{children}</div>;
}
