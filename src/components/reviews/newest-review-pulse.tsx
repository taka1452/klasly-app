"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "klasly:reviews:last-seen-id";

/**
 * Wraps the topmost review row with a one-shot golden pulse the first
 * time the viewer sees a review they haven't seen before. After the
 * animation lands the id is recorded in localStorage so the same row
 * doesn't keep flashing on every navigation.
 */
export function NewestReviewPulse({
  reviewId,
  children,
}: {
  reviewId: string;
  children: ReactNode;
}) {
  const [shouldPulse, setShouldPulse] = useState(false);
  const wroteSeenRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (seen !== reviewId) {
      setShouldPulse(true);
      // Record seen after pulse completes (matches CSS duration ~1.8s)
      const t = window.setTimeout(() => {
        window.localStorage.setItem(STORAGE_KEY, reviewId);
        wroteSeenRef.current = true;
      }, 1800);
      return () => window.clearTimeout(t);
    }
  }, [reviewId]);

  return (
    <div className={shouldPulse ? "review-pulse rounded-xl" : undefined}>
      {children}
    </div>
  );
}
