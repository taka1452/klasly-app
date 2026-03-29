"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWidgetTheme } from "./widget-theme-provider";
import WidgetEventCard from "./widget-event-card";

type EventData = {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  location_name: string | null;
  image_url: string | null;
  waitlist_enabled: boolean;
  options: {
    id: string;
    name: string;
    price_cents: number;
    remaining: number;
    early_bird_price_cents: number | null;
    early_bird_deadline: string | null;
  }[];
  min_price_cents: number;
  total_remaining: number;
};

type EventsResponse = {
  events: EventData[];
  studioName: string;
};

export default function WidgetEventList({ studioId }: { studioId: string }) {
  const theme = useWidgetTheme();
  const [data, setData] = useState<EventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/widget/${studioId}/events`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [studioId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Auto-resize iframe
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        const height = containerRef.current.scrollHeight;
        window.parent.postMessage(
          { type: "KLASLY_RESIZE", height: height + 20 },
          "*",
        );
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  // Determine base URL for event links
  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-bold" style={{ color: theme.primary }}>
          {data?.studioName ? `${data.studioName}` : "Events"}
        </h2>
        <p className="mt-0.5 text-xs text-gray-400">
          Upcoming events & retreats
        </p>
      </div>

      {/* Events Grid */}
      {!data?.events || data.events.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 py-12 text-center">
          <p className="text-sm text-gray-400">No upcoming events</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.events.map((event) => (
            <WidgetEventCard
              key={event.id}
              event={event}
              baseUrl={baseUrl}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 text-right">
        <span className="text-[10px] text-gray-300">Powered by Klasly</span>
      </div>
    </div>
  );
}
