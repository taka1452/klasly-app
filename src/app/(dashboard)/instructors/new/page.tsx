"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePlanAccess } from "@/components/ui/plan-access-provider";

export default function NewInstructorPage() {
  const router = useRouter();
  const planAccess = usePlanAccess();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (planAccess && !planAccess.canCreate) {
    return (
      <div className="card max-w-xl">
        <p className="text-gray-600">
          Your plan doesn&apos;t allow this action. Please update your payment
          to add new instructors.
        </p>
        <Link
          href="/settings/billing"
          className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Go to Billing →
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const specialtiesArray = specialties
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch("/api/instructors/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        phone: phone || undefined,
        bio: bio || undefined,
        specialties: specialtiesArray.length > 0 ? specialtiesArray : undefined,
      }),
    });

    let result: { error?: string };
    try {
      result = await res.json();
    } catch {
      setError("Failed to create instructor. Please try again.");
      setLoading(false);
      return;
    }

    if (!res.ok) {
      setError(result.error || "Failed to create instructor.");
      setLoading(false);
      return;
    }

    router.push("/instructors");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/instructors"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to instructors
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Add new instructor
        </h1>
      </div>

      <div className="card max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              required
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
              className="input-field mt-1"
            />
            <p className="mt-1 text-xs text-gray-400">
              An invitation email will be sent to this address.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone (optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Bio (optional)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Yoga instructor with 10 years of experience..."
              className="input-field mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Specialties (optional)
            </label>
            <input
              type="text"
              value={specialties}
              onChange={(e) => setSpecialties(e.target.value)}
              placeholder="Yoga, Pilates, Meditation"
              className="input-field mt-1"
            />
            <p className="mt-1 text-xs text-gray-400">
              Comma-separated list
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? "Adding..." : "Add instructor"}
            </button>
            <Link href="/instructors" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
