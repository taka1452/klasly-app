"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PasswordField from "@/components/ui/password-field";
import GoogleSignInButton from "@/components/auth/google-sign-in-button";
import HoneypotField from "@/components/ui/honeypot-field";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // メール未確認フロー用
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const err = searchParams.get("error");
    const msg = searchParams.get("msg");
    if (err === "auth_callback_failed") {
      let displayMsg = "Sign in with Google failed. Please try again or use email/password.";
      if (msg) {
        try {
          displayMsg = decodeURIComponent(msg);
        } catch {
          displayMsg = msg;
        }
      }
      setError(displayMsg);
    }
  }, [searchParams]);

  async function resendConfirmation(targetEmail: string) {
    setResendLoading(true);
    setResendSent(false);
    const supabase = createClient();
    await supabase.auth.resend({
      type: "signup",
      email: targetEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setResendSent(true);
    setResendLoading(false);
    // 60秒クールダウン
    setResendCooldown(60);
    const timer = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const hp = (e.target as HTMLFormElement).querySelector<HTMLInputElement>("#website");
    if (hp?.value) return;

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message === "Email not confirmed") {
        // 自動再送 → 専用UIへ切り替え
        setUnconfirmedEmail(email);
        await resendConfirmation(email);
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    // ロールに応じた適切なページへリダイレクト（Google SSOと同じ挙動）
    const res = await fetch("/api/auth/redirect-destination");
    const data = await res.json().catch(() => ({ url: "/" }));
    const url: string = data?.url ?? "/";
    router.push(url.startsWith("http") ? new URL(url).pathname : url);
    router.refresh();
  }

  // ─── メール未確認 専用UI ───────────────────────────────────────
  if (unconfirmedEmail) {
    return (
      <div>
        <div className="mb-8 lg:hidden">
          <h1 className="text-2xl font-bold text-brand-700">Klasly</h1>
        </div>

        <div className="text-center">
          {/* アイコン */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <svg
              className="h-8 w-8 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900">Confirm your email</h2>
          <p className="mt-2 text-sm text-gray-600">
            We sent a confirmation link to{" "}
            <span className="font-medium text-gray-900">{unconfirmedEmail}</span>.
            <br />
            Please check your inbox and click the link to activate your account.
          </p>

          {/* 送信完了メッセージ */}
          {resendSent && (
            <p className="mt-4 text-sm font-medium text-green-600">
              Confirmation email sent ✓
            </p>
          )}

          {/* 再送ボタン */}
          <button
            type="button"
            onClick={() => resendConfirmation(unconfirmedEmail)}
            disabled={resendLoading || resendCooldown > 0}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resendLoading
              ? "Sending…"
              : resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : "Resend confirmation email"}
          </button>

          {/* 別アカウントへ戻る */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => {
                setUnconfirmedEmail("");
                setResendSent(false);
                setResendCooldown(0);
              }}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              ← Use a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── 通常のログインフォーム ────────────────────────────────────
  return (
    <div>
      {/* モバイル用ロゴ */}
      <div className="mb-8 lg:hidden">
        <h1 className="text-2xl font-bold text-brand-700">Klasly</h1>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
        <p className="mt-1 text-sm text-gray-500">
          Sign in to manage your studio
        </p>
      </div>

      <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <HoneypotField />
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="input-field mt-1"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordField
            id="password"
            label=""
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-4 text-gray-500">or</span>
          </div>
        </div>

        <GoogleSignInButton mode="login" />
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          Start your free trial
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
        <p className="mt-4 text-sm text-gray-500">Loading...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
