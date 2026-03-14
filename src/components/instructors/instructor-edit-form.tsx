"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RentalType = "none" | "flat_monthly" | "per_class";

type TierOption = { id: string; name: string; monthly_minutes: number };

type Props = {
  instructorId: string;
  profileId: string;
  tiers: TierOption[];
  initialData: {
    fullName: string;
    phone: string;
    bio: string;
    specialties: string;
    rentalType: RentalType;
    rentalAmount: number; // cents
    tierId: string; // current tier assignment ("" = none)
  };
};

export default function InstructorEditForm({
  instructorId,
  profileId,
  tiers,
  initialData,
}: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialData.fullName);
  const [phone, setPhone] = useState(initialData.phone);
  const [bio, setBio] = useState(initialData.bio);
  const [specialties, setSpecialties] = useState(initialData.specialties);
  const [tierId, setTierId] = useState(initialData.tierId);
  const [rentalType, setRentalType] = useState<RentalType>(initialData.rentalType);
  const [rentalAmountDisplay, setRentalAmountDisplay] = useState(
    initialData.rentalAmount > 0 ? String(initialData.rentalAmount / 100) : ""
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);

    const specialtiesArray = specialties
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const supabase = createClient();

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone || null,
      })
      .eq("id", profileId);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    const rentalAmountCents =
      rentalType !== "none" ? Math.round((parseFloat(rentalAmountDisplay) || 0) * 100) : 0;

    const { error: instructorError } = await supabase
      .from("instructors")
      .update({
        bio: bio || null,
        specialties:
          specialtiesArray.length > 0 ? specialtiesArray : null,
        rental_type: rentalType,
        rental_amount: rentalAmountCents,
      })
      .eq("id", instructorId);

    if (instructorError) {
      setError(instructorError.message);
      setLoading(false);
      return;
    }

    // Update tier assignment
    if (tierId) {
      const tierRes = await fetch("/api/instructor-memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructor_id: instructorId, tier_id: tierId }),
      });
      if (!tierRes.ok) {
        const tierData = await tierRes.json();
        setError(tierData.error || "Failed to assign tier");
        setLoading(false);
        return;
      }
    } else if (initialData.tierId) {
      // Had a tier before, now removed
      await fetch(`/api/instructor-memberships?instructor_id=${instructorId}`, {
        method: "DELETE",
      });
    }

    setSaved(true);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900">Edit instructor</h2>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">
            Changes saved successfully!
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Full name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="input-field mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-field mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="input-field mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Specialties
          </label>
          <input
            type="text"
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            placeholder="Yoga, Pilates, Meditation"
            className="input-field mt-1"
          />
          <p className="mt-1 text-xs text-gray-400">Comma-separated list</p>
        </div>

        {/* Membership Tier */}
        {tiers.length > 0 && (
          <div className="border-t border-gray-200 pt-5">
            <h3 className="text-sm font-semibold text-gray-900">Room Booking Tier</h3>
            <p className="mt-1 text-xs text-gray-500">
              Assign a membership tier to set monthly room booking hour limits.
            </p>
            <select
              value={tierId}
              onChange={(e) => setTierId(e.target.value)}
              className="input-field mt-3"
            >
              <option value="">No tier (no limit)</option>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.monthly_minutes === -1 ? "Unlimited" : `${Math.floor(t.monthly_minutes / 60)}h ${t.monthly_minutes % 60}min/mo`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Studio Rental */}
        <div className="border-t border-gray-200 pt-5">
          <h3 className="text-sm font-semibold text-gray-900">Studio Rental</h3>
          <p className="mt-1 text-xs text-gray-500">
            Set the studio usage fee this instructor pays. Settlement is tracked
            in the monthly rental report.
          </p>

          <div className="mt-3 space-y-2">
            {(
              [
                { value: "none" as RentalType, label: "None", desc: "No studio rental fee" },
                { value: "flat_monthly" as RentalType, label: "Flat monthly", desc: "Fixed monthly studio usage fee" },
                { value: "per_class" as RentalType, label: "Per class", desc: "Fee per class taught" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                  rentalType === opt.value
                    ? "border-brand-400 bg-brand-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="rentalType"
                  value={opt.value}
                  checked={rentalType === opt.value}
                  onChange={() => setRentalType(opt.value)}
                  className="mt-0.5 accent-brand-500"
                />
                <div>
                  <p className="font-medium text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {rentalType !== "none" && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700">
                Amount
              </label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-gray-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rentalAmountDisplay}
                  onChange={(e) => setRentalAmountDisplay(e.target.value)}
                  placeholder="0.00"
                  className="input-field w-32"
                />
                <span className="text-sm text-gray-500">
                  {rentalType === "flat_monthly" ? "/ month" : "/ class"}
                </span>
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
