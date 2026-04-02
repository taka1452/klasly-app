"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  hasEnvCredentials: boolean;
  devEmail: string;
};

export default function DevLoginClient({ hasEnvCredentials, devEmail }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(devEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hasEnvCredentials ? {} : { email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Login failed");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        {/* Dev badge */}
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            DEV ONLY — not available in production
          </span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-bold text-gray-900">Dev Login</h1>
          <p className="mb-6 text-sm text-gray-500">
            One-click sign-in for local development.
          </p>

          {hasEnvCredentials ? (
            /* Single-button mode — credentials come from .env.local */
            <div>
              <div className="mb-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <span className="font-medium">Account:</span>{" "}
                <span className="font-mono">{devEmail}</span>
              </div>
              <button
                type="button"
                onClick={() => handleLogin()}
                disabled={loading}
                className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? "Signing in…" : `Sign in as ${devEmail}`}
              </button>
            </div>
          ) : (
            /* Form mode — user types credentials (env vars not set) */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="dev@example.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
              <p className="text-center text-xs text-gray-400">
                Tip: set <code className="font-mono">DEV_LOGIN_EMAIL</code> and{" "}
                <code className="font-mono">DEV_LOGIN_PASSWORD</code> in{" "}
                <code className="font-mono">.env.local</code> for one-click login.
              </p>
            </form>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
