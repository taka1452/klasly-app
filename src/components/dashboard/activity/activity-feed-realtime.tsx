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
 * When the tab is hidden we don't refresh — we just remember that
 * something changed and replay one refresh the next time the tab is
 * visible. Sonner: handle edge cases invisibly.
 *
 * No UI — this is purely a side-effect component mounted next to the
 * feed widget.
 */
export function ActivityFeedRealtime({ studioId }: { studioId: string }) {
  const router = useRouter();
  const timer = useRef<number | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    const runRefresh = () => {
      if (typeof document !== "undefined" && document.hidden) {
        pending.current = true;
        return;
      }
      pending.current = false;
      router.refresh();
    };

    const scheduleRefresh = () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
      timer.current = window.setTimeout(() => {
        timer.current = null;
        runRefresh();
      }, 3000);
    };

    const onVisibilityChange = () => {
      if (!document.hidden && pending.current) {
        pending.current = false;
        router.refresh();
      }
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

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [router, studioId]);

  return null;
}
