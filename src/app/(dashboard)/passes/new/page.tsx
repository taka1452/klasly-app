"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import HelpTip from "@/components/ui/help-tip";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

type ClassTemplate = { id: string; name: string };

type PassType = "monthly" | "class_pack" | "drop_in";

const PASS_TYPE_OPTIONS: { value: PassType; label: string; description: string }[] = [
  { value: "monthly", label: "Monthly Unlimited", description: "Recurring monthly subscription with unlimited or capped classes" },
  { value: "class_pack", label: "Class Pack", description: "One-time purchase for a fixed number of classes" },
  { value: "drop_in", label: "Drop-in", description: "Single session access pass" },
];

const EXPIRY_OPTIONS = [
  { value: "", label: "No expiry" },
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
  { value: "365", label: "1 year" },
];

export default function NewPassPage() {
  const router = useRouter();
  const { isEnabled } = useFeature();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [maxClasses, setMaxClasses] = useState("");
  const [passType, setPassType] = useState<PassType>("monthly");
  const [expiresAfterDays, setExpiresAfterDays] = useState("");
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [templates, setTemplates] = useState<ClassTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/class-templates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTemplates(data);
        else if (Array.isArray(data.templates)) setTemplates(data.templates);
      })
      .catch(() => {});
  }, []);

  function toggleTemplate(id: string) {
    setSelectedTemplates((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Pass name is required.");
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Please enter a valid price.");
      return;
    }
    if (passType === "monthly" && !unlimited) {
      const mc = parseInt(maxClasses, 10);
      if (isNaN(mc) || mc <= 0) {
        setError("Please enter a valid number of classes.");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/passes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          price_cents: Math.round(priceNum * 100),
          max_classes_per_month: passType === "monthly" && !unlimited ? parseInt(maxClasses, 10) : null,
          pass_type: passType,
          expires_after_days: expiresAfterDays ? parseInt(expiresAfterDays, 10) : null,
          class_template_ids: selectedTemplates.length > 0 ? selectedTemplates : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create pass.");
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
    return (
      <div className="card">
        <p className="text-sm text-gray-500">Studio passes are not enabled.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Create Pass</h1>
      <p className="mt-1 text-sm text-gray-500">
        Set up a new membership pass for your members
      </p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-lg space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Pass Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Pass Type
          </label>
          <div className="mt-2 space-y-2">
            {PASS_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  passType === opt.value
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="pass_type"
                  value={opt.value}
                  checked={passType === opt.value}
                  onChange={() => setPassType(opt.value)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Pass Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Unlimited Monthly" or "10 Class Pack"'
            className="input-field mt-1"
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
            placeholder="Describe what this pass includes..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Price ($)
          </label>
          <input
            type="number"
            min="0.50"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="49.99"
            className="input-field mt-1"
          />
        </div>

        {/* Classes per month — only for monthly type */}
        {passType === "monthly" && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Classes per month
              <HelpTip
                text="Set a monthly limit, or leave unlimited. Members see their remaining count."
                helpSlug="studio-pass"
              />
            </label>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={unlimited}
                  onChange={() => setUnlimited(true)}
                />
                <span className="text-sm text-gray-700">Unlimited</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!unlimited}
                  onChange={() => setUnlimited(false)}
                />
                <span className="text-sm text-gray-700">Limited</span>
              </label>
              {!unlimited && (
                <input
                  type="number"
                  min="1"
                  value={maxClasses}
                  onChange={(e) => setMaxClasses(e.target.value)}
                  placeholder="e.g. 8"
                  className="input-field mt-1 w-32"
                />
              )}
            </div>
          </div>
        )}

        {/* Expiry */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Expiry
            <HelpTip
              text="How long the pass is valid after purchase. Leave blank for no expiry."
              helpSlug="studio-pass"
            />
          </label>
          <select
            value={expiresAfterDays}
            onChange={(e) => setExpiresAfterDays(e.target.value)}
            className="input-field mt-1"
          >
            {EXPIRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Class selection */}
        {templates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Applicable Classes
              <HelpTip
                text="Select which classes this pass covers. Leave all unselected to apply to all classes."
                helpSlug="studio-pass"
              />
            </label>
            <p className="mt-0.5 text-xs text-gray-500">
              {selectedTemplates.length === 0
                ? "All classes (no restriction)"
                : `${selectedTemplates.length} class${selectedTemplates.length > 1 ? "es" : ""} selected`}
            </p>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {templates.map((tmpl) => (
                <label
                  key={tmpl.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedTemplates.includes(tmpl.id)}
                    onChange={() => toggleTemplate(tmpl.id)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600"
                  />
                  <span className="text-sm text-gray-700">{tmpl.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
