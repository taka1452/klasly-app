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
    capacity: number;
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

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  const events = data?.events || [];
  const [featured, ...rest] = events;

  return (
    <div ref={containerRef} className="p-4">
      {/* Header */}
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {data?.studioName ? `${data.studioName}` : "Events"}
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Upcoming events & retreats
          </p>
        </div>
        {events.length > 0 && (
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: theme.primary }}
          >
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        )}
      </div>

      {/* Events */}
      {events.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500">No upcoming events</p>
          <p className="mt-1 text-xs text-gray-400">Check back soon for new retreats & workshops</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Featured first event */}
          <WidgetEventCard
            event={featured}
            baseUrl={baseUrl}
            featured={true}
          />

          {/* Remaining events in compact layout */}
          {rest.length > 0 && (
            <div className="space-y-3">
              {rest.map((event) => (
                <WidgetEventCard
                  key={event.id}
                  event={event}
                  baseUrl={baseUrl}
                  featured={false}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-[10px] text-gray-300">Powered by Klasly</span>
      </div>
    </div>
  );
}
