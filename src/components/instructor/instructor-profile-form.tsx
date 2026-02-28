"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function InstructorProfileForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchProfile = useCallback(async () => {
    const res = await fetch("/api/instructor/profile");
    if (!res.ok) return;
    const data = await res.json();
    setFullName(data.full_name ?? "");
    setEmail(data.email ?? "");
    setBio(data.bio ?? "");
    setSpecialties(Array.isArray(data.specialties) ? data.specialties : []);
    setError("");
  }, []);

  useEffect(() => {
    fetchProfile().finally(() => setLoading(false));
  }, [fetchProfile]);

  function handleAddSpecialty(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && specialtyInput.trim()) {
      e.preventDefault();
      const val = specialtyInput.trim();
      if (val && !specialties.includes(val)) {
        setSpecialties([...specialties, val]);
        setSpecialtyInput("");
      }
    }
  }

  function handleRemoveSpecialty(idx: number) {
    setSpecialties(specialties.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/instructor/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        bio: bio || "",
        specialties,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      setError("Failed to save. Please try again.");
      return;
    }

    router.refresh();
  }

  if (loading) {
    return (
      <div className="card py-12 text-center text-sm text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-xl space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Display name
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your name"
          className="input-field mt-1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          type="email"
          value={email}
          readOnly
          disabled
          className="input-field mt-1 cursor-not-allowed bg-gray-50"
        />
        <p className="mt-1 text-xs text-gray-400">
          Email cannot be changed. Contact the studio owner if needed.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          placeholder="Tell members about yourself..."
          className="input-field mt-1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Specialties
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {specialties.map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800"
            >
              {s}
              <button
                type="button"
                onClick={() => handleRemoveSpecialty(i)}
                className="ml-1 rounded-full p-0.5 hover:bg-emerald-200"
                aria-label={`Remove ${s}`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={specialtyInput}
          onChange={(e) => setSpecialtyInput(e.target.value)}
          onKeyDown={handleAddSpecialty}
          placeholder="Add specialty (e.g. Yoga, Pilates) — press Enter"
          className="input-field mt-2"
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
