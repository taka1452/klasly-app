"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function GuardianSignPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [data, setData] = useState<{
    title: string;
    content: string;
    studioName: string;
    memberName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [relationship, setRelationship] = useState<"parent" | "legal_guardian">(
    "parent"
  );
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid link — missing token");
      setLoading(false);
      return;
    }

    async function fetchWaiver() {
      try {
        const res = await fetch(
          `/api/waiver/preview?token=${encodeURIComponent(token!)}`
        );
        const json = await res.json();

        if (!res.ok) {
          setError(json.error || "Invalid or expired link");
          return;
        }

        setData({
          title: json.title,
          content: json.content,
          studioName: json.studioName,
          memberName: json.memberName || "the member",
        });
      } catch {
        setError("Failed to load waiver");
      } finally {
        setLoading(false);
      }
    }

    fetchWaiver();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !guardianName.trim() || !agreed) return;
    setSigning(true);
    try {
      const res = await fetch("/api/waiver/guardian-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          guardian_name: guardianName.trim(),
          guardian_relationship: relationship,
          agreed: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to sign");
        return;
      }
      setSigned(true);
    } catch {
      setError("Failed to sign");
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        <p className="mt-4 text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <header className="fixed left-0 right-0 top-0 border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-16 max-w-2xl items-center px-4">
            <Link href="/" className="text-xl font-bold text-brand-700">
              Klasly
            </Link>
          </div>
        </header>
        <div className="mt-16 max-w-lg text-center">
          <p className="text-red-600">{error}</p>
          <Link
            href="/"
            className="mt-6 inline-block text-sm font-medium text-brand-600"
          >
            Go to home &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-2xl items-center px-4 sm:px-6">
          <Link href="/" className="text-xl font-bold text-brand-700">
            Klasly
          </Link>
          {data?.studioName && (
            <span className="ml-3 text-sm text-gray-500">
              &mdash; {data.studioName}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {signed ? (
          <div className="card text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Thank you!</h2>
            <p className="mt-2 text-gray-600">
              The waiver has been signed on behalf of {data?.memberName}.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            <h1 className="text-2xl font-bold text-gray-900">
              {data?.title || "Liability Waiver"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{data?.studioName}</p>

            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              You are signing this waiver on behalf of{" "}
              <strong>{data?.memberName}</strong>.
            </div>

            <div
              className="mt-6 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700"
              style={{ maxHeight: "300px" }}
            >
              <pre className="whitespace-pre-wrap font-sans">
                {data?.content || "No content."}
              </pre>
            </div>

            <form onSubmit={handleSubmit} className="card mt-8">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Guardian Full Name *
                </label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  required
                  className="input-field mt-1"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  Relationship *
                </label>
                <select
                  value={relationship}
                  onChange={(e) =>
                    setRelationship(
                      e.target.value as "parent" | "legal_guardian"
                    )
                  }
                  className="input-field mt-1"
                >
                  <option value="parent">Parent</option>
                  <option value="legal_guardian">Legal Guardian</option>
                </select>
              </div>

              <div className="mt-4 flex items-start gap-3">
                <input
                  id="agreeGuardian"
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-600"
                />
                <label
                  htmlFor="agreeGuardian"
                  className="text-sm text-gray-700"
                >
                  I have read and agree to the above waiver on behalf of{" "}
                  {data?.memberName}
                </label>
              </div>

              <button
                type="submit"
                disabled={signing || !guardianName.trim() || !agreed}
                className="btn-primary mt-6 w-full"
              >
                {signing ? "Signing\u2026" : "Sign and Submit"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
