"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { csrfFetch } from "@/lib/api/csrf-client";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import HelpTip from "@/components/ui/help-tip";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const BUFFER_OPTIONS = [0, 5, 10, 15, 30];

export default function NewAppointmentTypePage() {
  const router = useRouter();
  const { isEnabled } = useFeature();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [priceDollars, setPriceDollars] = useState("");
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      const res = await csrfFetch("/api/appointments/types", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          duration_minutes: durationMinutes,
          price_cents: Math.round(priceNum * 100),
          buffer_minutes: bufferMinutes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create appointment type.");
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

  return (
    <div>
      <Link
        href="/appointments"
        className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Back to appointments
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">
        Create Appointment Type{" "}
        <HelpTip
          text="Define a service that clients can book. Set the duration, price, and buffer time between appointments."
          helpSlug="appointments"
        />
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Set up a new type of appointment for your clients
      </p>

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

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Creating..." : "Create"}
          </button>
          <Link href="/appointments" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
