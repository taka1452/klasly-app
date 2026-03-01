"use client";

import { useState } from "react";

type Props = {
  memberId: string;
  waiverTitle: string;
  waiverContent: string;
  studioName: string;
  memberName: string;
  redirectTo?: string;
};

export default function InlineWaiverSign({
  memberId,
  waiverTitle,
  waiverContent,
  studioName,
  memberName,
  redirectTo,
}: Props) {
  const [signedName, setSignedName] = useState(memberName);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = signedName.trim();
    if (!name || !agreed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/waiver/sign-inline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, signedName: name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to sign");
        return;
      }
      if (redirectTo) {
        window.location.href = redirectTo;
      } else {
        window.location.reload();
      }
    } catch {
      setError("Failed to sign");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = signedName.trim().length > 0 && agreed && !loading;

  return (
    <div className="card">
      <h1 className="text-xl font-bold text-gray-900">
        📋 Before You Get Started
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Please read and sign the waiver below to start booking classes.
      </p>

      <div className="mt-6 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">{waiverTitle}</h2>
        <p className="text-sm text-gray-500">{studioName}</p>
        <div
          className="prose prose-sm mt-4 max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: waiverContent }}
        />
      </div>

      <form onSubmit={handleSubmit} className="mt-6">
        <label className="block text-sm font-medium text-gray-700">
          Full Name (as signature)
        </label>
        <input
          type="text"
          value={signedName}
          onChange={(e) => setSignedName(e.target.value)}
          className="input-field mt-1 w-full"
          placeholder="Enter your full name"
        />

        <div className="mt-4 flex items-start gap-3">
          <input
            id="waiver-agree"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600"
          />
          <label htmlFor="waiver-agree" className="text-sm text-gray-700">
            I have read and agree to the above waiver
          </label>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary mt-6 w-full"
        >
          {loading ? "Signing…" : "Sign and Continue →"}
        </button>

        <p className="mt-4 text-xs text-amber-700">
          ⚠ By signing, you acknowledge that you have read and understood this waiver.
        </p>
      </form>
    </div>
  );
}
