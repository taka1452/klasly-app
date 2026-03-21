"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FlowHintPanel from "@/components/ui/flow-hint-panel";
import Toast from "@/components/ui/toast";

type Props = {
  studioId: string;
  isOwner?: boolean;
};

const THEME_OPTIONS = [
  { value: "green", label: "Green", color: "#059669" },
  { value: "blue", label: "Blue", color: "#0074c5" },
  { value: "purple", label: "Purple", color: "#7c3aed" },
  { value: "red", label: "Red", color: "#dc2626" },
  { value: "orange", label: "Orange", color: "#ea580c" },
  { value: "pink", label: "Pink", color: "#db2777" },
  { value: "teal", label: "Teal", color: "#0d9488" },
] as const;

export default function WidgetSettingsClient({ studioId, isOwner = true }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [themeColor, setThemeColor] = useState("green");
  const [allowedOrigins, setAllowedOrigins] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [copied, setCopied] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/studio/widget-settings");
        if (!res.ok) return;
        const data = await res.json();
        setEnabled(data.enabled ?? false);
        setThemeColor(data.themeColor ?? "green");
        setAllowedOrigins(data.allowedOrigins ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/studio/widget-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, themeColor, allowedOrigins }),
      });
      if (!res.ok) {
        const data = await res.json();
        setToastMessage(data.error || "Failed to save");
        return;
      }
      setToastMessage("Settings saved");
      router.refresh();
    } catch {
      setToastMessage("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleAddDomain() {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;
    // Basic validation: remove protocol if present
    const clean = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (clean && !allowedOrigins.includes(clean)) {
      setAllowedOrigins([...allowedOrigins, clean]);
    }
    setNewDomain("");
  }

  function handleRemoveDomain(domain: string) {
    setAllowedOrigins(allowedOrigins.filter((d) => d !== domain));
  }

  function handleCopyCode() {
    const code = getEmbedCode();
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function getEmbedCode() {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://app.klasly.app";
    return `<script src="${baseUrl}/widget.js" data-studio="${studioId}" data-theme="${themeColor}"></script>`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <p className="mt-3 text-sm text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* How to embed hint */}
      <div className="flex justify-end">
        <FlowHintPanel flowType="widget-embed" buttonLabel="How to embed" />
      </div>

      {/* Enable/Disable Toggle */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Enable Widget
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Allow your class schedule to be embedded on external websites.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
              enabled ? "bg-brand-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Theme Color */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900">Theme Color</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose the accent color for your embedded widget.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {THEME_OPTIONS.map((theme) => (
            <button
              key={theme.value}
              type="button"
              onClick={() => setThemeColor(theme.value)}
              className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                themeColor === theme.value
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: theme.color }}
              />
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      {/* Embed Code */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900">Embed Code</h2>
        <p className="mt-1 text-sm text-gray-500">
          Copy this code and paste it into your website&apos;s HTML where you
          want the schedule to appear.
        </p>
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <code className="block whitespace-pre-wrap break-all text-xs text-gray-800">
            {getEmbedCode()}
          </code>
        </div>
        <button
          type="button"
          onClick={handleCopyCode}
          className="btn-secondary mt-3 text-sm"
        >
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>
      </div>

      {/* Allowed Domains */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900">
          Allowed Domains
          <span className="ml-2 text-xs font-normal text-gray-400">
            Optional
          </span>
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Restrict which websites can embed your widget. Leave empty to allow
          any website.
        </p>

        {allowedOrigins.length > 0 && (
          <ul className="mt-4 space-y-2">
            {allowedOrigins.map((domain) => (
              <li
                key={domain}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
              >
                <span className="text-sm text-gray-800">{domain}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDomain(domain)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label={`Remove ${domain}`}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddDomain();
              }
            }}
            placeholder="e.g. example.com"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={handleAddDomain}
            className="btn-secondary text-sm"
          >
            Add
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900">Preview</h2>
        <p className="mt-1 text-sm text-gray-500">
          See how your widget will look when embedded.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
          <iframe
            src={`/widget/${studioId}?theme=${themeColor}`}
            className="h-[500px] w-full border-0"
            title="Widget preview"
          />
        </div>
      </div>

      {/* Save */}
      {isOwner ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Only the studio owner can modify widget settings.
        </p>
      )}

      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}
