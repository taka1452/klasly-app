"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { csrfFetch } from "@/lib/api/csrf-client";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import HelpTip from "@/components/ui/help-tip";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const BUFFER_OPTIONS = [0, 5, 10, 15, 30];

type AppointmentType = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number;
  buffer_minutes: number;
  is_active: boolean;
};

export default function EditAppointmentTypePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { isEnabled } = useFeature();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [priceDollars, setPriceDollars] = useState("");
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchType() {
      try {
        const res = await fetch("/api/appointments/types");
        if (!res.ok) {
          setError("Failed to load appointment type.");
          setFetching(false);
          return;
        }
        const data: AppointmentType[] = await res.json();
        const type = data.find((t) => t.id === id);
        if (!type) {
          setError("Appointment type not found.");
          setFetching(false);
          return;
        }
        setName(type.name);
        setDescription(type.description || "");
        setDurationMinutes(type.duration_minutes);
        setPriceDollars(
          type.price_cents > 0 ? (type.price_cents / 100).toFixed(2) : ""
        );
        setBufferMinutes(type.buffer_minutes);
        setIsActive(type.is_active);
      } catch {
        setError("An unexpected error occurred.");
      } finally {
        setFetching(false);
      }
    }
    fetchType();
  }, [id]);

  if (!isEnabled(FEATURE_KEYS.APPOINTMENTS)) {
    return (
      <div className="card py-12 text-center">
        <p className="text-gray-500">
          Appointments feature is not enabled for your studio.
        </p>
        <Link
          href="/settings/features"
          className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Manage Features &rarr;
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Appointment type name is required.");
      return;
    }

    const priceNum = priceDollars ? parseFloat(priceDollars) : 0;
    if (priceDollars && (isNaN(priceNum) || priceNum < 0)) {
      setError("Please enter a valid price.");
      return;
    }

    setLoading(true);
    try {
      const res = await csrfFetch(`/api/appointments/types/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          duration_minutes: durationMinutes,
          price_cents: Math.round(priceNum * 100),
          buffer_minutes: bufferMinutes,
          is_active: isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update appointment type.");
        return;
      }

      router.push("/appointments");
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">Loading...</div>
    );
  }

  return (
    <div>
      <Link
        href="/appointments"
        className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to appointments
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">
        Edit Appointment Type{" "}
        <HelpTip
          text="Update the details of this appointment type."
          helpSlug="appointments"
        />
      </h1>

      <form onSubmit={handleSubmit} className="mt-6 max-w-lg space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "60-Minute Massage" or "Initial Consultation"'
            className="input-field mt-1"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input-field mt-1"
            placeholder="Describe what this appointment includes..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Duration
          </label>
          <select
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="input-field mt-1"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Price ($)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            placeholder="0.00 (leave empty for free)"
            className="input-field mt-1"
          />
          <p className="mt-1 text-xs text-gray-400">
            Leave at 0 or empty for free appointments
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Buffer Time{" "}
            <HelpTip
              text="Buffer time is added between appointments to give you a break or prep time."
              helpSlug="appointments"
            />
          </label>
          <select
            value={bufferMinutes}
            onChange={(e) => setBufferMinutes(Number(e.target.value))}
            className="input-field mt-1"
          >
            {BUFFER_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b === 0 ? "No buffer" : `${b} minutes`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
          <p className="mt-1 text-xs text-gray-400">
            Inactive types are not visible or bookable by clients
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Saving..." : "Save Changes"}
          </button>
          <Link href="/appointments" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
