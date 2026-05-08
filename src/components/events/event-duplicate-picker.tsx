"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PastEvent = {
  id: string;
  name: string;
  start_date: string;
  status: string;
};

export type DuplicatedEventData = {
  // Basic Info (dates are NOT included — user sets fresh)
  name: string;
  description: string;
  location_name: string;
  location_address: string;
  image_url: string;
  is_public: boolean;
  color: string | null;
  // Gallery & Details
  gallery_images: string[];
  packing_list: Array<{ item: string; category?: string }>;
  access_info: string;
  location_lat: string;
  location_lng: string;
  waitlist_enabled: boolean;
  // Options
  options: Array<{
    name: string;
    description: string;
    priceDollars: string;
    capacity: string;
    earlyBirdDollars: string;
    earlyBirdDeadline: string;
  }>;
  // Schedule
  schedule_items: Array<{
    day_number: number;
    start_time: string;
    end_time: string;
    title: string;
    description: string;
  }>;
  // Payment
  payment_type: "full" | "installment" | "both";
  // Cancellation
  cancellation_policy: Array<{
    days_before: number;
    refund_percent: number;
    fee_cents: number;
    note: string;
  }>;
  cancellation_policy_text: string;
  // Application Form
  application_fields: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    placeholder: string;
    options: string;
  }>;
};

type Props = {
  studioId: string;
  onApply: (data: DuplicatedEventData, sourceName: string) => void;
};

/**
 * Compact picker shown at the top of the Create Event form.
 * Lets the owner duplicate every setting (name through application form)
 * from any past event in the studio. Dates are NOT copied — they're the
 * one field the user always wants to set fresh on a new event.
 */
export default function EventDuplicatePicker({ studioId, onApply }: Props) {
  const [pastEvents, setPastEvents] = useState<PastEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("events")
        .select("id, name, start_date, status")
        .eq("studio_id", studioId)
        .order("start_date", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setPastEvents(data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studioId]);

  async function handleApply() {
    if (!selectedId) return;
    setError("");
    setApplying(true);
    const supabase = createClient();

    try {
      const [eventRes, optionsRes, scheduleRes] = await Promise.all([
        supabase.from("events").select("*").eq("id", selectedId).single(),
        supabase
          .from("event_options")
          .select("*")
          .eq("event_id", selectedId)
          .order("sort_order"),
        supabase
          .from("event_schedule_items")
          .select("*")
          .eq("event_id", selectedId)
          .order("sort_order"),
      ]);

      if (eventRes.error || !eventRes.data) {
        setError("Couldn't load that event.");
        setApplying(false);
        return;
      }

      const e = eventRes.data;

      const formatDateTimeLocal = (v: string | null): string => {
        if (!v) return "";
        // Postgres timestamptz → "YYYY-MM-DDTHH:mm" for <input type="datetime-local">
        const d = new Date(v);
        if (isNaN(d.getTime())) return "";
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };

      const data: DuplicatedEventData = {
        name: `${e.name ?? ""} (copy)`,
        description: e.description ?? "",
        location_name: e.location_name ?? "",
        location_address: e.location_address ?? "",
        image_url: e.image_url ?? "",
        is_public: e.is_public ?? true,
        color: e.color ?? null,
        gallery_images: Array.isArray(e.gallery_images) ? e.gallery_images : [],
        packing_list: Array.isArray(e.packing_list) ? e.packing_list : [],
        access_info: e.access_info ?? "",
        location_lat: e.location_lat != null ? String(e.location_lat) : "",
        location_lng: e.location_lng != null ? String(e.location_lng) : "",
        waitlist_enabled: e.waitlist_enabled ?? false,
        options: (optionsRes.data ?? []).map((o) => ({
          name: o.name ?? "",
          description: o.description ?? "",
          priceDollars: o.price_cents != null
            ? (o.price_cents / 100).toString()
            : "",
          capacity: o.capacity != null ? String(o.capacity) : "10",
          earlyBirdDollars:
            o.early_bird_price_cents != null
              ? (o.early_bird_price_cents / 100).toString()
              : "",
          earlyBirdDeadline: formatDateTimeLocal(o.early_bird_deadline ?? null),
        })),
        schedule_items: (scheduleRes.data ?? []).map((s) => ({
          day_number: s.day_number ?? 1,
          start_time: (s.start_time ?? "").slice(0, 5),
          end_time: (s.end_time ?? "").slice(0, 5),
          title: s.title ?? "",
          description: s.description ?? "",
        })),
        payment_type: e.payment_type === "installment" ? "installment" : e.payment_type === "both" ? "both" : "full",
        cancellation_policy: Array.isArray(e.cancellation_policy)
          ? e.cancellation_policy
          : [],
        cancellation_policy_text: e.cancellation_policy_text ?? "",
        application_fields: Array.isArray(e.application_fields)
          ? e.application_fields.map(
              (f: {
                id?: string;
                label?: string;
                type?: string;
                required?: boolean;
                placeholder?: string;
                options?: string[] | string;
              }) => ({
                id: f.id ?? `f${Date.now()}${Math.random()}`,
                label: f.label ?? "",
                type: f.type ?? "text",
                required: !!f.required,
                placeholder: f.placeholder ?? "",
                options: Array.isArray(f.options)
                  ? f.options.join(", ")
                  : (f.options ?? ""),
              }),
            )
          : [],
      };

      onApply(data, e.name ?? "");
      setSelectedId("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setApplying(false);
    }
  }

  if (loading) return null;
  if (pastEvents.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-brand-200 bg-brand-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-600">
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-900">
            Reuse settings from a past event
          </p>
          <p className="mt-0.5 text-xs text-brand-700">
            Copies everything (name, options, schedule, cancellation policy,
            application form) — you only need to set new dates.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="input-field flex-1"
              aria-label="Select past event"
            >
              <option value="">Pick an event…</option>
              {pastEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} · {ev.start_date}
                  {ev.status === "draft" ? " (draft)" : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleApply}
              disabled={!selectedId || applying}
              style={{ transitionTimingFunction: "var(--ease-out-strong)" }}
              className="btn-primary whitespace-nowrap text-sm transition-[transform,background-color] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 motion-reduce:active:scale-100"
            >
              {applying ? "Loading…" : "Reuse settings"}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
