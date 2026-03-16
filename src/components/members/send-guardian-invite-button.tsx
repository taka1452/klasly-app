"use client";

import { useState } from "react";

type Props = {
  memberId: string;
};

export default function SendGuardianInviteButton({ memberId }: Props) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/waiver/send-guardian-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send");
      } else {
        setSent(true);
      }
    } catch {
      setError("Failed to send");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <p className="mt-2 text-sm text-green-600">
        Guardian invite sent!
      </p>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleSend}
        disabled={loading}
        className="btn-primary text-sm"
      >
        {loading ? "Sending..." : "Send Guardian Waiver Invite"}
      </button>
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
