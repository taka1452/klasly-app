"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Live updates for the Activity feed.
 *
 * Subscribes to INSERT events on the three highest-signal source tables
 * (bookings, class_audit_log, studio_audit_log), filtered to the
 * viewer's studio. When something lands we don't re-fetch ourselves —
 * we just call router.refresh() so the server component that built the
 * feed re-runs with the new data.
 *
 * Debounced 3s so a burst of writes (e.g. a multi-row import) refreshes
 * the page once, not N times.
 *
 * No UI — this is purely a side-effect component mounted next to the
 * feed widget.
 */
export function ActivityFeedRealtime({ studioId }: { studioId: string }) {
  const router = useRouter();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const scheduleRefresh = () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      timer.current = window.setTimeout(() => {
        timer.current = null;
        router.refresh();
      }, 3000);
    };

    const channel = supabase
      .channel(`activity:${studioId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookings",
          filter: `studio_id=eq.${studioId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "class_audit_log",
          filter: `studio_id=eq.${studioId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "studio_audit_log",
          filter: `studio_id=eq.${studioId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [router, studioId]);

  return null;
}
