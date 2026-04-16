"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Toast from "@/components/ui/toast";

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
  const [toast, setToast] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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

    setToast("Changes saved successfully");
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="card">
      {toast && (
        <Toast message={toast} onClose={() => setToast(null)} variant="success" />
      )}
      <h2 className="text-lg font-semibold text-gray-900">Edit instructor</h2>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
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

        {/* Contract */}
        <div className="border-t border-gray-200 pt-5">
          <h3 className="text-sm font-semibold text-gray-900">Contract</h3>
          <p className="mt-1 text-xs text-gray-500">
            Choose how this instructor pays to use your studio. Pick{" "}
            <strong>one</strong> of the two models below (or leave both blank
            for no contract). Plans are defined on the{" "}
            <a
              href="/settings/contracts"
              className="text-brand-600 hover:text-brand-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              Contracts settings
            </a>{" "}
            page.
          </p>

          {/* A. Hourly plan */}
          {tiers.length > 0 && (
            <div className="mt-4 rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-900">
                A. Hourly plan{" "}
                <span className="font-normal text-gray-400">
                  (subscription with monthly hour allowance)
                </span>
              </p>
              <select
                value={tierId}
                onChange={(e) => setTierId(e.target.value)}
                className="input-field mt-3"
              >
                <option value="">No hourly plan</option>
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.monthly_minutes === -1 ? "Unlimited" : `${Math.floor(t.monthly_minutes / 60)}h ${t.monthly_minutes % 60}min/mo`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* B. Flat / per-class fee */}
          <div className="mt-4 rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-900">
              B. Flat / per-class fee{" "}
              <span className="font-normal text-gray-400">
                (manual settlement via monthly report)
              </span>
            </p>
            <div className="mt-3 space-y-2">
              {(
                [
                  { value: "none" as RentalType, label: "None", desc: "No flat / per-class fee" },
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

          {tierId && rentalType !== "none" && (
            <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
              ⚠ This instructor has both an hourly plan and a flat/per-class
              fee set. In most studios you only want one. Consider clearing the
              other to avoid double-charging.
            </p>
          )}
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
