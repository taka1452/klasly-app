"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Toast from "@/components/ui/toast";

type RentalType = "none" | "flat_monthly" | "per_class";
type ContractTab = "none" | "hourly" | "flat";

type TierOption = {
  id: string;
  name: string;
  monthly_minutes: number;
  monthly_price?: number | null;
  allow_overage?: boolean | null;
  overage_rate_cents?: number | null;
};

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

  // Which contract tab is active. Defaults to whichever model has data;
  // if both exist (legacy), prefer "hourly" and surface a warning.
  const initialContractTab: ContractTab = initialData.tierId
    ? "hourly"
    : initialData.rentalType !== "none"
      ? "flat"
      : "none";
  const [contractTab, setContractTab] = useState<ContractTab>(initialContractTab);

  function selectContractTab(next: ContractTab) {
    setContractTab(next);
    if (next !== "hourly") setTierId("");
    if (next !== "flat") {
      setRentalType("none");
      setRentalAmountDisplay("");
    }
  }
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
            Choose how this instructor pays to use your studio. Hourly plans
            are defined on the{" "}
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

          {/* Tabs */}
          <div className="mt-4 border-b border-gray-200">
            <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Contract type">
              {(
                [
                  { key: "none" as ContractTab, label: "No contract" },
                  { key: "hourly" as ContractTab, label: "Hourly plan" },
                  { key: "flat" as ContractTab, label: "Flat / per-class" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => selectContractTab(t.key)}
                  className={`whitespace-nowrap border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
                    contractTab === t.key
                      ? "border-brand-500 text-brand-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Panel: None */}
          {contractTab === "none" && (
            <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
              No contract — this instructor uses the studio without a direct fee.
              You can assign a contract later.
            </div>
          )}

          {/* Panel: Hourly plan */}
          {contractTab === "hourly" && (
            <div className="mt-4 rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">
                Subscription with a monthly hour allowance. Billed
                automatically via Stripe. Extra hours beyond the plan can
                optionally be billed per-hour (configured on each plan).
              </p>
              {tiers.length > 0 ? (
                <>
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

                  {/* Overage policy badge for the selected tier */}
                  {(() => {
                    if (!tierId) return null;
                    const selected = tiers.find((t) => t.id === tierId);
                    if (!selected) return null;
                    const unlimited = selected.monthly_minutes === -1;
                    if (unlimited) {
                      return (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                          ✨ <strong>Unlimited hours</strong> — no overage ever applies.
                        </div>
                      );
                    }
                    if (selected.allow_overage) {
                      const rate =
                        selected.overage_rate_cents != null
                          ? `$${(selected.overage_rate_cents / 100).toFixed(2)}/hour`
                          : "not set";
                      return (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                          💳 <strong>Overage allowed</strong> — extra hours beyond the plan are billed at <strong>{rate}</strong> on the 1st of the following month.
                        </div>
                      );
                    }
                    return (
                      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-700">
                        🚫 <strong>Hard limit</strong> — this plan blocks further bookings once the monthly allowance runs out.
                      </div>
                    );
                  })()}

                  <p className="mt-2 text-xs text-gray-400">
                    Don&apos;t see the right plan or want to change the overage rate?{" "}
                    <a
                      href="/settings/contracts?tab=hourly"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-700"
                    >
                      Manage hourly plans →
                    </a>
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-gray-600">
                  No hourly plans defined yet.{" "}
                  <a
                    href="/settings/contracts?tab=hourly"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand-600 hover:text-brand-700"
                  >
                    Create one in Settings →
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Panel: Flat / per-class */}
          {contractTab === "flat" && (
            <div className="mt-4 rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500">
                Fixed monthly amount or per-class fee. Settlement is manual —
                collect payment outside the app using the{" "}
                <a
                  href="/settings/contracts?tab=flat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:text-brand-700"
                >
                  monthly report
                </a>
                .
              </p>
              <div className="mt-3 space-y-2">
                {(
                  [
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
          )}

          {tierId && rentalType !== "none" && (
            <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
              ⚠ Legacy state: both an hourly plan and a flat/per-class fee are
              set. Switch tabs (which auto-clears the other side) and save to
              fix.
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
