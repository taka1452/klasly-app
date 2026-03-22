"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import type { CancellationPolicyTier } from "@/types/database";
import HelpTip from "@/components/ui/help-tip";

type OptionDraft = {
  name: string;
  description: string;
  priceDollars: string;
  capacity: string;
};

const STEPS = ["Basic Info", "Room Options", "Payment", "Cancellation Policy", "Application Form"];

function generatePolicyText(tiers: CancellationPolicyTier[]): string {
  if (tiers.length === 0) return "";
  const sorted = [...tiers].sort((a, b) => b.days_before - a.days_before);
  return sorted
    .map((t) => {
      const days = `${t.days_before}+ days before`;
      const refund =
        t.refund_percent === 100
          ? "Full refund"
          : t.refund_percent === 0
            ? "No refund"
            : `${t.refund_percent}% refund`;
      const fee = t.fee_cents > 0 ? ` minus $${(t.fee_cents / 100).toFixed(0)} fee` : "";
      const note = t.note ? ` — ${t.note}` : "";
      return `${days}: ${refund}${fee}${note}`;
    })
    .join("\n");
}

export default function CreateEventPage() {
  const router = useRouter();
  const { isEnabled } = useFeature();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Basic Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Step 2: Options
  const [options, setOptions] = useState<OptionDraft[]>([
    { name: "", description: "", priceDollars: "", capacity: "10" },
  ]);

  // Step 3: Payment
  const [paymentType, setPaymentType] = useState<"full" | "installment">("full");

  // Step 4: Cancellation
  const [policyTiers, setPolicyTiers] = useState<CancellationPolicyTier[]>([]);
  const [policyText, setPolicyText] = useState("");

  // Step 5: Application Form
  type AppField = { id: string; label: string; type: string; required: boolean; placeholder: string; options: string };
  const [appFields, setAppFields] = useState<AppField[]>([]);

  if (!isEnabled(FEATURE_KEYS.RETREAT_BOOKING)) {
    return (
      <div className="card py-12 text-center">
        <p className="text-gray-500">Events &amp; Retreats feature is not enabled for your studio.</p>
        <p className="mt-2 text-sm text-gray-400">Go to Settings → Features to enable it.</p>
        <Link href="/settings/features" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
          Manage Features →
        </Link>
      </div>
    );
  }

  function addAppField() {
    setAppFields((f) => [...f, { id: `f${Date.now()}`, label: "", type: "text", required: false, placeholder: "", options: "" }]);
  }
  function removeAppField(i: number) {
    setAppFields((f) => f.filter((_, idx) => idx !== i));
  }
  function updateAppField(i: number, field: keyof AppField, value: string | boolean) {
    setAppFields((f) => f.map((af, idx) => (idx === i ? { ...af, [field]: value } : af)));
  }

  function addOption() {
    setOptions((o) => [...o, { name: "", description: "", priceDollars: "", capacity: "10" }]);
  }
  function removeOption(i: number) {
    setOptions((o) => o.filter((_, idx) => idx !== i));
  }
  function updateOption(i: number, field: keyof OptionDraft, value: string) {
    setOptions((o) => o.map((opt, idx) => (idx === i ? { ...opt, [field]: value } : opt)));
  }

  function addTier() {
    setPolicyTiers((t) => [...t, { days_before: 30, refund_percent: 100, fee_cents: 0, note: "" }]);
  }
  function removeTier(i: number) {
    setPolicyTiers((t) => t.filter((_, idx) => idx !== i));
  }
  function updateTier(i: number, field: keyof CancellationPolicyTier, value: string | number) {
    setPolicyTiers((t) =>
      t.map((tier, idx) => (idx === i ? { ...tier, [field]: value } : tier)),
    );
  }

  async function handleSave(status: "draft" | "published") {
    setError("");
    if (status === "published") {
      if (!name.trim()) { setError("Event name is required."); return; }
      if (!startDate || !endDate) { setError("Start and end dates are required."); return; }
      const validOptions = options.filter((o) => o.name.trim());
      if (validOptions.length === 0) { setError("At least one option is required."); return; }
    }

    setSaving(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated.");
      setSaving(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("studio_id")
      .eq("id", user.id)
      .single();
    if (!profile?.studio_id) {
      setError("Could not find studio.");
      setSaving(false);
      return;
    }

    const { data: event, error: insertError } = await supabase
      .from("events")
      .insert({
        studio_id: profile.studio_id,
        name: name.trim(),
        description: description.trim() || null,
        location_name: locationName.trim() || null,
        location_address: locationAddress.trim() || null,
        start_date: startDate,
        end_date: endDate || startDate,
        image_url: imageUrl.trim() || null,
        is_public: isPublic,
        status,
        payment_type: paymentType,
        installment_count: paymentType === "installment" ? 3 : 1,
        cancellation_policy: policyTiers,
        cancellation_policy_text: policyText.trim() || null,
        application_fields: appFields.filter((f) => f.label.trim()).map((f) => ({
          id: f.id,
          label: f.label.trim(),
          type: f.type,
          required: f.required,
          placeholder: f.placeholder.trim(),
          ...(["select", "radio", "checkbox"].includes(f.type)
            ? { options: f.options.split(",").map((o) => o.trim()).filter(Boolean) }
            : {}),
        })),
      })
      .select("id")
      .single();

    if (insertError || !event) {
      setError(insertError?.message || "Failed to create event.");
      setSaving(false);
      return;
    }

    // Insert options
    const validOptions = options.filter((o) => o.name.trim());
    if (validOptions.length > 0) {
      const optionsToInsert = validOptions.map((o, idx) => ({
        event_id: event.id,
        name: o.name.trim(),
        description: o.description.trim() || null,
        price_cents: Math.round(parseFloat(o.priceDollars || "0") * 100),
        capacity: parseInt(o.capacity || "10", 10),
        sort_order: idx,
      }));

      await supabase.from("event_options").insert(optionsToInsert);
    }

    router.push(`/events/${event.id}/manage`);
    router.refresh();
  }

  const maxPrice = Math.max(
    ...options.map((o) => parseFloat(o.priceDollars || "0")),
    0,
  );

  return (
    <div>
      <div className="mb-6">
        <Link href="/events" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to events
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Create Event</h1>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium transition ${
              i === step
                ? "bg-brand-600 text-white"
                : i < step
                  ? "bg-brand-100 text-brand-700"
                  : "bg-gray-100 text-gray-500"
            }`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="card">
        {/* Step 1: Basic Info */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Event Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bali Yoga Retreat 2026" required className="input-field mt-1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe your event..." className="input-field mt-1" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Location Name</label>
                <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Villa Harmony" className="input-field mt-1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Location Address</label>
                <input type="text" value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} placeholder="Ubud, Bali, Indonesia" className="input-field mt-1" />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date *</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="input-field mt-1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date *</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} required className="input-field mt-1" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Image URL</label>
              <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/retreat-image.jpg" className="input-field mt-1" />
              <p className="mt-1 text-xs text-gray-400">Paste a link to your cover image.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Visibility
                <HelpTip
                  text="Private events are only visible to logged-in members. Use for corporate retreats."
                  helpSlug="events-retreats"
                />
              </label>
              <div className="mt-1 flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" checked={isPublic} onChange={() => setIsPublic(true)} className="text-brand-600" />
                  Public
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="radio" checked={!isPublic} onChange={() => setIsPublic(false)} className="text-brand-600" />
                  Members only
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Room Options */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Add room types or ticket tiers. Each option can have its own price and capacity.
            </p>
            {options.map((opt, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Option {i + 1}</span>
                  {options.length > 1 && (
                    <button type="button" onClick={() => removeOption(i)} className="text-xs text-red-500 hover:text-red-700">
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Name *</label>
                    <input type="text" value={opt.name} onChange={(e) => updateOption(i, "name", e.target.value)} placeholder="Shared Room" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Description</label>
                    <input type="text" value={opt.description} onChange={(e) => updateOption(i, "description", e.target.value)} placeholder="Twin beds, ocean view" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Price ($)</label>
                    <input type="number" value={opt.priceDollars} onChange={(e) => updateOption(i, "priceDollars", e.target.value)} placeholder="1500" min="0" step="0.01" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Capacity</label>
                    <input type="number" value={opt.capacity} onChange={(e) => updateOption(i, "capacity", e.target.value)} placeholder="10" min="1" className="input-field mt-1" />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addOption} className="btn-secondary text-sm">
              + Add Option
            </button>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Payment Type
                <HelpTip
                  text="Installment splits the total into 3 equal payments: at booking, 30 days later, and 60 days later."
                  helpSlug="events-retreats"
                />
              </label>
              <div className="mt-2 space-y-2">
                <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4 cursor-pointer hover:bg-gray-50">
                  <input type="radio" checked={paymentType === "full"} onChange={() => setPaymentType("full")} className="mt-0.5 text-brand-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Full payment</p>
                    <p className="text-xs text-gray-500">Members pay the full amount at booking.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-4 cursor-pointer hover:bg-gray-50">
                  <input type="radio" checked={paymentType === "installment"} onChange={() => setPaymentType("installment")} className="mt-0.5 text-brand-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">3 installments</p>
                    <p className="text-xs text-gray-500">Members pay 1/3 at booking, 1/3 after 30 days, 1/3 after 60 days.</p>
                  </div>
                </label>
              </div>
            </div>
            {paymentType === "installment" && maxPrice > 0 && (
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-800">Payment Preview</p>
                <p className="mt-1 text-xs text-blue-700">
                  For the ${maxPrice.toFixed(0)} option:
                </p>
                <ul className="mt-2 space-y-1 text-xs text-blue-700">
                  <li>1st payment (at booking): ${(maxPrice / 3).toFixed(2)}</li>
                  <li>2nd payment (after 30 days): ${(maxPrice / 3).toFixed(2)}</li>
                  <li>3rd payment (after 60 days): ${(maxPrice - (Math.floor(maxPrice / 3 * 100) / 100) * 2).toFixed(2)}</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Cancellation Policy */}
        {step === 3 && (
          <div className="space-y-5">
            <p className="text-sm text-gray-500 inline-flex items-center gap-1">
              Define refund tiers based on how far in advance a guest cancels.
              <HelpTip
                text="Set refund rules by time before the event. Each retreat can have its own policy."
                helpSlug="events-retreats"
              />
            </p>
            {policyTiers.map((tier, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Tier {i + 1}</span>
                  <button type="button" onClick={() => removeTier(i)} className="text-xs text-red-500 hover:text-red-700">
                    Remove
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Days before start</label>
                    <input type="number" value={tier.days_before} onChange={(e) => updateTier(i, "days_before", parseInt(e.target.value || "0", 10))} min="0" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Refund %</label>
                    <input type="number" value={tier.refund_percent} onChange={(e) => updateTier(i, "refund_percent", parseInt(e.target.value || "0", 10))} min="0" max="100" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Fee ($)</label>
                    <input type="number" value={tier.fee_cents / 100} onChange={(e) => updateTier(i, "fee_cents", Math.round(parseFloat(e.target.value || "0") * 100))} min="0" step="1" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Note</label>
                    <input type="text" value={tier.note} onChange={(e) => updateTier(i, "note", e.target.value)} placeholder="Optional note" className="input-field mt-1" />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addTier} className="btn-secondary text-sm">
              + Add Tier
            </button>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Policy Text</label>
                {policyTiers.length > 0 && (
                  <button type="button" onClick={() => setPolicyText(generatePolicyText(policyTiers))} className="text-xs text-brand-600 hover:text-brand-700">
                    Auto-generate from tiers
                  </button>
                )}
              </div>
              <textarea value={policyText} onChange={(e) => setPolicyText(e.target.value)} rows={4} placeholder="Describe your cancellation policy..." className="input-field mt-1" />
            </div>
          </div>
        )}

        {/* Step 5: Application Form */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Add custom questions for guests to answer when booking (e.g. dietary restrictions, experience level).
            </p>
            {appFields.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-sm text-gray-500">
                  No application form. Guests will only provide their name and email.
                </p>
                <button type="button" onClick={addAppField} className="btn-secondary mt-4 text-sm">
                  + Add Question
                </button>
              </div>
            ) : (
              <>
                {appFields.map((af, i) => (
                  <div key={af.id} className="rounded-lg border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Question {i + 1}</span>
                      <button type="button" onClick={() => removeAppField(i)} className="text-xs text-red-500 hover:text-red-700">
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Label *</label>
                        <input type="text" value={af.label} onChange={(e) => updateAppField(i, "label", e.target.value)} placeholder="e.g. Dietary restrictions" className="input-field mt-1" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Type</label>
                        <select value={af.type} onChange={(e) => updateAppField(i, "type", e.target.value)} className="input-field mt-1">
                          <option value="text">Short text</option>
                          <option value="textarea">Long text</option>
                          <option value="select">Dropdown</option>
                          <option value="radio">Radio buttons</option>
                          <option value="checkbox">Checkbox</option>
                        </select>
                      </div>
                    </div>
                    {["select", "radio"].includes(af.type) && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500">Options (comma-separated)</label>
                        <input type="text" value={af.options} onChange={(e) => updateAppField(i, "options", e.target.value)} placeholder="Beginner, Intermediate, Advanced" className="input-field mt-1" />
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      {["text", "textarea"].includes(af.type) && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Placeholder</label>
                          <input type="text" value={af.placeholder} onChange={(e) => updateAppField(i, "placeholder", e.target.value)} placeholder="e.g. Vegan, Gluten-free" className="input-field mt-1" />
                        </div>
                      )}
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={af.required} onChange={(e) => updateAppField(i, "required", e.target.checked)} className="rounded accent-brand-600" />
                          Required
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addAppField} className="btn-secondary text-sm">
                  + Add Question
                </button>
              </>
            )}
          </div>
        )}

        {/* Navigation + Save */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-6">
          <div>
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary text-sm">
                &larr; Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => setStep(step + 1)} className="btn-primary text-sm">
                Next &rarr;
              </button>
            ) : (
              <>
                <button type="button" onClick={() => handleSave("draft")} disabled={saving} className="btn-secondary">
                  {saving ? "Saving..." : "Save as Draft"}
                </button>
                <button type="button" onClick={() => handleSave("published")} disabled={saving} className="btn-primary">
                  {saving ? "Publishing..." : "Publish"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
