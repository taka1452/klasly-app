"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PasswordField from "@/components/ui/password-field";

function SetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
      }
    });
  }, [router]);

  async function goToDestination() {
    const nextPath = nextParam && nextParam.startsWith("/") ? nextParam : null;
    if (nextPath) {
      router.replace(nextPath);
      return;
    }
    const res = await fetch("/api/auth/redirect-destination");
    const data = await res.json().catch(() => ({ url: "/" }));
    const url = data?.url ?? "/";
    router.replace(url.startsWith("http") ? new URL(url).pathname : url);
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    await supabase.auth.updateUser({
      data: { invited_without_password: false },
    });

    setSuccess(true);
    setLoading(false);

    setTimeout(() => {
      goToDestination();
    }, 1500);
  }

  async function handleSkip() {
    setSkipLoading(true);
    const supabase = createClient();
    await supabase.auth.updateUser({
      data: { invited_without_password: false },
    });
    await goToDestination();
  }

  if (success) {
    return (
      <div>
        <div className="mb-8 lg:hidden">
          <h1 className="text-2xl font-bold text-brand-700">Klasly</h1>
        </div>
        <div className="text-center">
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
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Password set successfully
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 lg:hidden">
        <h1 className="text-2xl font-bold text-brand-700">Klasly</h1>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Set your password</h2>
        <p className="mt-1 text-sm text-gray-500">
          Set a password so you can sign in with your email next time.
        </p>
      </div>

      <form onSubmit={handleSetPassword} className="mt-8 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="At least 6 characters"
          required
          minLength={6}
          autoComplete="new-password"
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Repeat your password"
          required
          minLength={6}
          autoComplete="new-password"
        />

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? "Setting..." : "Set password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        <button
          type="button"
          onClick={handleSkip}
          disabled={skipLoading}
          className="font-medium text-brand-600 hover:text-brand-700 disabled:opacity-70"
        >
          {skipLoading ? "Skipping..." : "Skip for now"}
        </button>
        <span className="ml-1">
          — you can set a password later from the login page (Forgot password).
        </span>
      </p>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      }
    >
      <SetPasswordContent />
    </Suspense>
  );
}
