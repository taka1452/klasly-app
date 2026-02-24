"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [studioName, setStudioName] = useState("");
  const [studioEmail, setStudioEmail] = useState("");
  const [studioPhone, setStudioPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // すでにスタジオを持っている場合はダッシュボードへリダイレクト（マウント時に1回のみ）
  useEffect(() => {
    let cancelled = false;

    async function checkStudio() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch("/api/onboarding/status", {
          credentials: "same-origin",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (data.redirectToLogin) {
          router.push("/login");
          return;
        }

        if (data.hasStudio) {
          router.push("/dashboard");
          return;
        }

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!cancelled) {
          setStudioEmail(user?.email || "");
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load. Please refresh the page.");
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    checkStudio();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateStudio(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/onboarding/create-studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: studioName,
        email: studioEmail || null,
        phone: studioPhone || null,
      }),
    });

    let result: { error?: string };
    try {
      result = await res.json();
    } catch {
      setError("Failed to create studio. Please try again.");
      setLoading(false);
      return;
    }

    if (!res.ok) {
      setError(result.error || "Failed to create studio.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"></div>
          <p className="mt-4 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-700">Klasly</h1>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Set up your studio
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Tell us about your studio to get started
          </p>
        </div>

        <div className="card mt-8">
          <form onSubmit={handleCreateStudio} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="studioName"
                className="block text-sm font-medium text-gray-700"
              >
                Studio name *
              </label>
              <input
                id="studioName"
                type="text"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                placeholder="Sunrise Yoga Studio"
                required
                className="input-field mt-1"
              />
            </div>

            <div>
              <label
                htmlFor="studioEmail"
                className="block text-sm font-medium text-gray-700"
              >
                Studio email
              </label>
              <input
                id="studioEmail"
                type="email"
                value={studioEmail}
                onChange={(e) => setStudioEmail(e.target.value)}
                placeholder="hello@yourstudio.com"
                className="input-field mt-1"
              />
              <p className="mt-1 text-xs text-gray-400">
                Contact email for your studio (can be different from your account
                email)
              </p>
            </div>

            <div>
              <label
                htmlFor="studioPhone"
                className="block text-sm font-medium text-gray-700"
              >
                Phone number (optional)
              </label>
              <input
                id="studioPhone"
                type="tel"
                value={studioPhone}
                onChange={(e) => setStudioPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="input-field mt-1"
              />
            </div>

            <div className="rounded-lg bg-brand-50 p-4">
              <p className="text-sm font-medium text-brand-800">
                Free plan — up to 10 members
              </p>
              <p className="mt-1 text-xs text-brand-600">
                You can upgrade to Studio ($19/mo) or Grow ($39/mo) anytime.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Creating studio..." : "Create studio"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
