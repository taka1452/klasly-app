"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCampaignPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  async function handleSave() {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required.");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setCampaignId(data.id);
    setLoading(false);
  }

  async function handleSend() {
    if (!campaignId) return;
    setSending(true);
    setError("");

    const res = await fetch(`/api/campaigns/${campaignId}/send`, {
      method: "POST",
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to send.");
      setSending(false);
      return;
    }

    const data = await res.json();
    setSentCount(data.sentCount);
    setSent(true);
    setSending(false);
  }

  if (sent) {
    return (
      <div>
        <h1 className="text-xl font-bold text-gray-900">Campaign Sent!</h1>
        <p className="mt-2 text-sm text-gray-500">
          Successfully sent to {sentCount} member{sentCount !== 1 ? "s" : ""}.
        </p>
        <button
          onClick={() => router.push("/campaigns")}
          className="btn-primary mt-4"
        >
          Back to Campaigns
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">New Campaign</h1>
      <p className="mt-1 text-sm text-gray-500">
        Compose and send an email to all active members
      </p>

      <div className="mt-6 max-w-2xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Subject
          </label>
          <input
            type="text"
            className="input-field"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject line"
            maxLength={200}
            disabled={!!campaignId}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Body
          </label>
          <textarea
            className="input-field"
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email content here..."
            maxLength={5000}
            disabled={!!campaignId}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          {!campaignId ? (
            <>
              <button
                onClick={handleSave}
                className="btn-primary"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Draft"}
              </button>
              <button
                onClick={() => router.push("/campaigns")}
                className="btn-secondary"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSend}
                className="btn-primary"
                disabled={sending}
              >
                {sending ? "Sending..." : "Send Now"}
              </button>
              <button
                onClick={() => router.push("/campaigns")}
                className="btn-secondary"
              >
                Send Later
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
