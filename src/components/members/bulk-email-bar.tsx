"use client";

import { useState } from "react";

type Props = {
  tag: string;
  filteredCount: number;
};

/**
 * Inline bulk-email composer that appears on /members when a tag
 * filter is active. Click "Email these N members" → expand subject /
 * body inputs → send. Server resolves the actual recipient list from
 * the same tag filter (so the count and the send agree).
 */
export default function BulkEmailBar({ tag, filteredCount }: Props) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    sent: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState("");

  if (tag === "all" || !tag) return null;

  async function send() {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/members/bulk-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send");
        return;
      }
      setResult({ sent: data.sent ?? 0, skipped: data.skipped ?? 0 });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-gray-700">
          <strong>{filteredCount}</strong> member{filteredCount === 1 ? "" : "s"}{" "}
          tagged <code className="font-mono text-xs">{tag}</code>
        </p>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Email these members →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSubject("");
              setBody("");
              setResult(null);
              setError("");
            }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          {error && (
            <div className="rounded-md bg-red-50 p-2 text-xs text-red-600">
              {error}
            </div>
          )}
          {result && (
            <div className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-700">
              Sent to {result.sent} member{result.sent === 1 ? "" : "s"}
              {result.skipped > 0 ? `, ${result.skipped} skipped` : ""}.
            </div>
          )}
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="input-field"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder={`Hi {memberName},\n\nThanks for being part of our community...`}
            className="input-field"
          />
          <p className="text-xs text-gray-500">
            Variables: <code className="font-mono">{`{memberName}`}</code>,{" "}
            <code className="font-mono">{`{studioName}`}</code>.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={send}
              disabled={sending}
              className="btn-primary text-sm"
            >
              {sending ? "Sending…" : `Send to ${filteredCount}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
