"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import HelpTip from "@/components/ui/help-tip";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

type ClassTemplate = { id: string; name: string };
type PassType = "monthly" | "class_pack" | "drop_in";
type ExpiryMode = "none" | "duration" | "fixed_date";
type DurationUnit = "days" | "weeks" | "months";

const PASS_TYPE_OPTIONS: { value: PassType; label: string; description: string }[] = [
  { value: "monthly", label: "Monthly Unlimited", description: "Recurring monthly subscription with unlimited or capped classes" },
  { value: "class_pack", label: "Class Pack", description: "One-time purchase for a fixed number of classes" },
  { value: "drop_in", label: "Drop-in", description: "Single session access pass" },
];

const DURATION_UNITS: { value: DurationUnit; label: string; daysPerUnit: number }[] = [
  { value: "days", label: "Days", daysPerUnit: 1 },
  { value: "weeks", label: "Weeks", daysPerUnit: 7 },
  { value: "months", label: "Months", daysPerUnit: 30 },
];

const DURATION_PRESETS: { label: string; value: number; unit: DurationUnit }[] = [
  { label: "1 month", value: 1, unit: "months" },
  { label: "3 months", value: 3, unit: "months" },
  { label: "4 months", value: 4, unit: "months" },
  { label: "6 months", value: 6, unit: "months" },
  { label: "1 year", value: 12, unit: "months" },
];

function daysToUnit(days: number): { value: number; unit: DurationUnit } {
  if (days % 30 === 0) return { value: days / 30, unit: "months" };
  if (days % 7 === 0) return { value: days / 7, unit: "weeks" };
  return { value: days, unit: "days" };
}

type PassData = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  max_classes_per_month: number | null;
  pass_type: PassType;
  expires_after_days: number | null;
  expires_on: string | null;
  is_active: boolean;
  class_template_ids: string[];
};

export default function EditPassPage() {
  const router = useRouter();
  const params = useParams();
  const passId = params.id as string;
  const { isEnabled } = useFeature();

  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [maxClasses, setMaxClasses] = useState("");
  const [passType, setPassType] = useState<PassType>("monthly");
  const [expiryMode, setExpiryMode] = useState<ExpiryMode>("none");
  const [durationValue, setDurationValue] = useState("3");
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("months");
  const [expiresOn, setExpiresOn] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [templates, setTemplates] = useState<ClassTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/passes/${passId}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/class-templates").then((r) => r.json()).catch(() => []),
    ]).then(([pass, tmplData]) => {
      if (!pass) {
        setNotFound(true);
        setLoaded(true);
        return;
      }
      const p = pass as PassData;
      setName(p.name);
      setDescription(p.description ?? "");
      setPrice((p.price_cents / 100).toFixed(2));
      setPassType(p.pass_type);
      setIsActive(p.is_active);
      if (p.max_classes_per_month !== null) {
        setUnlimited(false);
        setMaxClasses(String(p.max_classes_per_month));
      }
      if (p.expires_after_days) {
        setExpiryMode("duration");
        const parsed = daysToUnit(p.expires_after_days);
        setDurationValue(String(parsed.value));
        setDurationUnit(parsed.unit);
      } else if (p.expires_on) {
        setExpiryMode("fixed_date");
        setExpiresOn(p.expires_on);
      }
      setSelectedTemplates(p.class_template_ids ?? []);
      const list = Array.isArray(tmplData) ? tmplData : tmplData.templates ?? [];
      setTemplates(list);
      setLoaded(true);
    });
  }, [passId]);

  function toggleTemplate(id: string) {
    setSelectedTemplates((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Pass name is required."); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) { setError("Please enter a valid price."); return; }
    if (passType === "monthly" && !unlimited) {
      const mc = parseInt(maxClasses, 10);
      if (isNaN(mc) || mc <= 0) { setError("Please enter a valid number of classes."); return; }
    }
    let expiresAfterDays: number | null = null;
    if (expiryMode === "duration") {
      const n = parseInt(durationValue, 10);
      if (isNaN(n) || n <= 0) { setError("Please enter a positive duration."); return; }
      const unit = DURATION_UNITS.find((u) => u.value === durationUnit);
      expiresAfterDays = n * (unit?.daysPerUnit ?? 1);
    }
    if (expiryMode === "fixed_date" && !expiresOn) { setError("Please select an expiration date."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/passes/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passId,
          name: name.trim(),
          description: description.trim() || null,
          price_cents: Math.round(priceNum * 100),
          max_classes_per_month: passType === "monthly" && !unlimited ? parseInt(maxClasses, 10) : null,
          pass_type: passType,
          is_active: isActive,
          expires_after_days: expiryMode === "duration" ? expiresAfterDays : null,
          expires_on: expiryMode === "fixed_date" ? expiresOn : null,
          class_template_ids: selectedTemplates.length > 0 ? selectedTemplates : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update pass.");
        return;
      }
      router.push("/passes");
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  if (!isEnabled(FEATURE_KEYS.STUDIO_PASS)) {
    return <div className="card"><p className="text-sm text-gray-500">Studio passes are not enabled.</p></div>;
  }

  if (!loaded) {
    return <div className="card"><p className="text-sm text-gray-500">Loading…</p></div>;
  }

  if (notFound) {
    return <div className="card"><p className="text-sm text-red-600">Pass not found.</p></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Edit Pass</h1>
      <p className="mt-1 text-sm text-gray-500">Update this membership pass</p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-lg space-y-5">
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {/* Active / Inactive toggle */}
        <div className="flex items-center gap-3">
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="peer sr-only"
            />
            <div className="h-5 w-9 rounded-full bg-gray-200 transition-colors duration-200 ease-out after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform after:duration-200 after:ease-out peer-checked:bg-brand-500 peer-checked:after:translate-x-full peer-focus:outline-none" />
          </label>
          <span className="text-sm font-medium text-gray-700">
            {isActive ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Pass Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Pass Type</label>
          <div className="mt-2 space-y-2">
            {PASS_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99] ${
                  passType === opt.value ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input type="radio" name="pass_type" value={opt.value} checked={passType === opt.value} onChange={() => setPassType(opt.value)} className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Pass Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g. "Unlimited Monthly"' className="input-field mt-1" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input-field mt-1" placeholder="Describe what this pass includes..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Price ($)</label>
          <input type="number" min="0.50" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="49.99" className="input-field mt-1" />
        </div>

        {passType === "monthly" && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Classes per month
              <HelpTip text="Set a monthly limit, or leave unlimited. Members see their remaining count." helpSlug="studio-pass" />
            </label>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2">
                <input type="radio" checked={unlimited} onChange={() => setUnlimited(true)} />
                <span className="text-sm text-gray-700">Unlimited</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={!unlimited} onChange={() => setUnlimited(false)} />
                <span className="text-sm text-gray-700">Limited</span>
              </label>
              {!unlimited && (
                <input type="number" min="1" value={maxClasses} onChange={(e) => setMaxClasses(e.target.value)} placeholder="e.g. 8" className="input-field mt-1 w-32" />
              )}
            </div>
          </div>
        )}

        {/* Expiry */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Expiry
            <HelpTip text="How long the pass is valid after purchase. Leave blank for no expiry." helpSlug="studio-pass" />
          </label>
          <div className="mt-2 space-y-2">
            {([
              { value: "none" as ExpiryMode, label: "No expiry", desc: "Pass never expires" },
              { value: "duration" as ExpiryMode, label: "Valid for…", desc: "Expires N days/weeks/months after purchase" },
              { value: "fixed_date" as ExpiryMode, label: "Fixed expiry date", desc: "All passes expire on the same date (e.g. end of season)" },
            ] as const).map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99] ${
                  expiryMode === opt.value ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input type="radio" name="expiryMode" value={opt.value} checked={expiryMode === opt.value} onChange={() => { setExpiryMode(opt.value); if (opt.value !== "fixed_date") setExpiresOn(""); }} className="mt-0.5 accent-brand-500" />
                <div>
                  <p className="font-medium text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {expiryMode === "duration" && (
            <div className="mt-3 rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <input type="number" min="1" value={durationValue} onChange={(e) => setDurationValue(e.target.value)} className="input-field w-24" />
                <select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value as DurationUnit)} className="input-field w-32">
                  {DURATION_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
                <span className="text-xs text-gray-500">after purchase</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DURATION_PRESETS.map((p) => (
                  <button key={p.label} type="button" onClick={() => { setDurationValue(String(p.value)); setDurationUnit(p.unit); }} className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-600 transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 active:scale-[0.97]">
                    {p.label}
                  </button>
                ))}
              </div>
              {durationUnit === "months" && <p className="mt-2 text-xs text-gray-400">Months are counted as 30-day periods.</p>}
            </div>
          )}

          {expiryMode === "fixed_date" && (
            <div className="mt-3 rounded-lg border border-gray-200 p-3">
              <label className="block text-xs text-gray-500">All purchases of this pass expire on this date</label>
              <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className="input-field mt-1" />
            </div>
          )}
        </div>

        {templates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Applicable Classes
              <HelpTip text="Select which classes this pass covers. Leave all unselected to apply to all classes." helpSlug="studio-pass" />
            </label>
            <p className="mt-0.5 text-xs text-gray-500">
              {selectedTemplates.length === 0 ? "All classes (no restriction)" : `${selectedTemplates.length} class${selectedTemplates.length > 1 ? "es" : ""} selected`}
            </p>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {templates.map((tmpl) => (
                <label key={tmpl.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors duration-150 ease-out hover:bg-gray-50">
                  <input type="checkbox" checked={selectedTemplates.includes(tmpl.id)} onChange={() => toggleTemplate(tmpl.id)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
                  <span className="text-sm text-gray-700">{tmpl.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary">
            <span className="label-swap" data-pending={loading}>
              {loading ? "Saving…" : "Save Changes"}
            </span>
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
