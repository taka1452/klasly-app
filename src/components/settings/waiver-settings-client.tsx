"use client";

import { useState } from "react";

type Template = { id: string; title: string; content: string } | null;
type UnsignedMember = { id: string; fullName: string; email: string };

type Props = {
  template: Template;
  signedCount: number;
  totalCount: number;
  unsignedMembers: UnsignedMember[];
};

export default function WaiverSettingsClient({
  template: initialTemplate,
  signedCount,
  totalCount,
  unsignedMembers,
}: Props) {
  const [title, setTitle] = useState(initialTemplate?.title ?? "Liability Waiver");
  const [content, setContent] = useState(initialTemplate?.content ?? "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await fetch("/api/waiver/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Liability Waiver", content: "" }),
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

  async function handleSave() {
    setLoading(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/waiver/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
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
      <div className="mt-8 card">
        <p className="text-gray-600">
          Set up your liability waiver
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Create a waiver template that members will sign before attending classes.
        </p>
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading}
          className="btn-primary mt-6"
        >
          {loading ? "Creating…" : "Create Waiver"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Waiver Template</h2>

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
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="input-field mt-1 w-full resize-y"
            placeholder="Enter your waiver text here. This will be shown to members before they sign."
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
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Waiver Status</h2>
        <p className="mt-2 text-sm text-gray-600">
          {signedCount} / {totalCount} members signed
        </p>

        {unsignedMembers.length > 0 && (
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
        )}

        {unsignedMembers.length === 0 && totalCount > 0 && (
          <p className="mt-4 text-sm text-green-600">All members have signed.</p>
        )}
      </div>
    </div>
  );
}
