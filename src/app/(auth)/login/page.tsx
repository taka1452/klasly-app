"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PasswordField from "@/components/ui/password-field";
import GoogleSignInButton from "@/components/auth/google-sign-in-button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
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
