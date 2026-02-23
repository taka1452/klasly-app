"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // メールのリンクからリダイレクトされた時にセッションを取得
  useEffect(() => {
    const supabase = createClient();

    // URL のハッシュフラグメントからセッションを復元
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });
  }, []);

  async function handleResetPassword(e: React.FormEvent) {
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
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // 3秒後にダッシュボードへ
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 3000);
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
            Password updated!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Redirecting to your dashboard...
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
        <h2 className="text-2xl font-bold text-gray-900">Set new password</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter your new password below
        </p>
      </div>

      <form onSubmit={handleResetPassword} className="mt-8 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {!sessionReady && (
          <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
            Loading your session... If this takes too long, please click the
            reset link in your email again.
          </div>
        )}

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
            minLength={6}
            className="input-field mt-1"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700"
          >
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
            required
            minLength={6}
            className="input-field mt-1"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !sessionReady}
          className="btn-primary w-full"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link
          href="/login"
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
