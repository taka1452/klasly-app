"use client";

import { useState } from "react";
import { WAIVER_PRESETS, type WaiverPreset } from "@/lib/waiver-presets";
import { htmlToMarkdown, markdownToHtml } from "@/lib/waiver-content";

type Template = { id: string; title: string; content: string } | null;
type UnsignedMember = { id: string; fullName: string; email: string };

type Props = {
  template: Template;
  studioName: string;
  signedCount: number;
  totalCount: number;
  unsignedMembers: UnsignedMember[];
};

function getReplacedContent(preset: WaiverPreset, studioName: string): string {
  return preset.content.replaceAll("{{STUDIO_NAME}}", studioName);
}

function PresetGrid({
  studioName,
  onSelect,
  disabled,
}: {
  studioName: string;
  onSelect: (content: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {WAIVER_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onSelect(getReplacedContent(preset, studioName))}
          disabled={disabled}
          className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-300 hover:shadow-md disabled:opacity-50"
        >
          <span className="text-2xl" aria-hidden>
            {preset.icon}
          </span>
          <h3 className="mt-2 font-semibold text-gray-900">{preset.name}</h3>
          <p className="mt-1 line-clamp-3 text-sm text-gray-500">
            {preset.description}
          </p>
        </button>
      ))}
    </div>
  );
}

const LEGAL_DISCLAIMER =
  "These templates are provided as starting points only and do not constitute legal advice. We recommend having your waiver reviewed by a legal professional.";

export default function WaiverSettingsClient({
  template: initialTemplate,
  studioName,
  signedCount,
  totalCount,
  unsignedMembers,
}: Props) {
  const [title, setTitle] = useState(initialTemplate?.title ?? "Liability Waiver");
  const [content, setContent] = useState(
    initialTemplate?.content != null ? htmlToMarkdown(initialTemplate.content) : ""
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState<number | null>(null);
  const [showPresetPicker, setShowPresetPicker] = useState(false);

  async function handleCreateFromPreset(contentWithStudio: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/waiver/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Liability Waiver",
          content: contentWithStudio,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create");
      }
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setLoading(false);
    }
  }

  function handleLoadPreset(contentWithStudio: string) {
    setContent(htmlToMarkdown(contentWithStudio));
    setShowPresetPicker(false);
  }

  async function handleSave() {
    setLoading(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/waiver/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: markdownToHtml(content),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkInvite() {
    if (unsignedMembers.length === 0) return;
    const ok = window.confirm(
      `Send waiver invite to ${unsignedMembers.length} unsigned member${unsignedMembers.length !== 1 ? "s" : ""}?`
    );
    if (!ok) return;

    setBulkLoading(true);
    setBulkSuccess(null);
    try {
      const res = await fetch("/api/waiver/send-bulk-invite", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send");
      }
      setBulkSuccess(data.sent ?? 0);
      setTimeout(() => setBulkSuccess(null), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send invites");
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleResend(memberId: string) {
    setResendLoading(memberId);
    try {
      const res = await fetch("/api/waiver/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send");
      }
      alert("Invite sent!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setResendLoading(null);
    }
  }

  if (!initialTemplate) {
    return (
      <div className="mt-8">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">Set Up Your Waiver</h2>
          <p className="mt-1 text-sm text-gray-600">
            Choose a template to get started. You can customize it after.
          </p>
          <div className="mt-6">
            <PresetGrid
              studioName={studioName}
              onSelect={handleCreateFromPreset}
              disabled={loading}
            />
          </div>
          <p className="mt-6 text-xs text-gray-500">{LEGAL_DISCLAIMER}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Waiver Template</h2>

        {showPresetPicker ? (
          <>
            <p className="mt-1 text-sm text-gray-600">
              Choose a template. Your current content will be replaced.
            </p>
            <div className="mt-4">
              <PresetGrid studioName={studioName} onSelect={handleLoadPreset} />
            </div>
            <button
              type="button"
              onClick={() => setShowPresetPicker(false)}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <p className="mt-4 text-xs text-gray-500">{LEGAL_DISCLAIMER}</p>
          </>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  const ok = window.confirm(
                    "Current content will be overwritten. Continue?"
                  );
                  if (ok) setShowPresetPicker(true);
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                🔄 Load a preset template
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field mt-1"
                placeholder="Liability Waiver"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Content</label>
              <p className="mt-1 text-xs text-gray-500">
                Write in plain text (Markdown). Headings: # ## ###, bold: **text**, lists: - item
              </p>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                className="input-field mt-1 w-full resize-y font-mono text-sm"
                placeholder="# Liability Waiver&#10;&#10;Enter your waiver text here. Use # for headings, ** for bold."
              />
            </div>

            {success && (
              <p className="mt-4 text-sm font-medium text-green-600">
                Waiver template saved
              </p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="btn-primary mt-4"
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Waiver Status</h2>
        <p className="mt-2 text-sm text-gray-600">
          {signedCount} / {totalCount} members signed
        </p>

        {unsignedMembers.length > 0 && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleBulkInvite}
                disabled={!!bulkLoading}
                className="btn-primary text-sm"
              >
                {bulkLoading ? "Sending…" : "Send to All Unsigned Members"}
              </button>
              {bulkSuccess !== null && (
                <span className="text-sm font-medium text-green-600">
                  Invites sent to {bulkSuccess} members
                </span>
              )}
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700">Unsigned members</h3>
              <ul className="mt-3 divide-y divide-gray-200">
                {unsignedMembers.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-3 first:pt-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.fullName}</p>
                      <p className="text-xs text-gray-500">{m.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResend(m.id)}
                      disabled={!!resendLoading}
                      className="btn-secondary text-sm"
                    >
                      {resendLoading === m.id ? "Sending…" : "Resend Invite"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {unsignedMembers.length === 0 && totalCount > 0 && (
          <p className="mt-4 text-sm text-green-600">All members have signed.</p>
        )}
      </div>
    </div>
  );
}
