"use client";

import { useCallback, useEffect, useState } from "react";

type Account = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "instructor" | "member";
  isCurrent: boolean;
  isTest: boolean;
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-brand-100 text-brand-700",
  manager: "bg-amber-100 text-amber-700",
  instructor: "bg-blue-100 text-blue-700",
  member: "bg-green-100 text-green-700",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  instructor: "Instructor",
  member: "Member",
};

const ORIGINAL_COOKIE = "klasly_test_switch_origin";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[-.+]/g, "\\$&") + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSec = 60 * 60 * 4) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export default function TestAccountSwitcher() {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentRole, setCurrentRole] = useState<string>("");
  const [studioName, setStudioName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [currentIsTest, setCurrentIsTest] = useState(false);
  const [originalProfileId, setOriginalProfileId] = useState<string | null>(
    null
  );

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dev/switch-role");
      if (!res.ok) {
        setAuthorized(false);
        return;
      }
      const data = await res.json();
      setAuthorized(true);
      const accts: Account[] = data.accounts ?? [];
      setAccounts(accts);
      setCurrentRole(data.currentRole ?? "");
      setStudioName(data.studioName ?? "");
      setCurrentIsTest(
        accts.find((a) => a.isCurrent)?.isTest === true
      );
    } catch {
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    setOriginalProfileId(readCookie(ORIGINAL_COOKIE));
  }, [fetchAccounts]);

  const [switchError, setSwitchError] = useState<string | null>(null);

  async function switchTo(target: Account) {
    if (target.isCurrent) {
      // Friendly inline feedback instead of a silent no-op so the user sees
      // that the click registered (Jamie feedback 2026-04: "nothing happens").
      setSwitchError("That's the account you're already signed in as.");
      return;
    }
    if (!target.isTest) {
      setSwitchError("You can only switch into test accounts, not real users.");
      return;
    }
    setSwitchError(null);
    setSwitching(target.id);
    try {
      const res = await fetch("/api/dev/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProfileId: target.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSwitchError(data.error ?? "Failed to switch account.");
        setSwitching(null);
        return;
      }
      const { url, originalProfileId: origId } = await res.json();
      // Remember where to return to — but only if we're not already
      // inside a test session (don't overwrite the real origin).
      if (!readCookie(ORIGINAL_COOKIE) && origId) {
        writeCookie(ORIGINAL_COOKIE, origId);
      }
      window.location.href = url;
    } catch {
      setSwitchError(
        "Couldn't contact the server. Check your connection and try again."
      );
      setSwitching(null);
    }
  }

  async function switchBack() {
    const origId = readCookie(ORIGINAL_COOKIE);
    if (!origId) {
      setSwitchError(
        "We couldn't find your original account. Please sign out and sign in again."
      );
      return;
    }
    setSwitchError(null);
    setSwitching(origId);
    try {
      const res = await fetch("/api/dev/switch-back", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalProfileId: origId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSwitchError(data.error ?? "Failed to switch back.");
        setSwitching(null);
        return;
      }
      const { url } = await res.json();
      deleteCookie(ORIGINAL_COOKIE);
      window.location.href = url;
    } catch {
      setSwitchError("Failed to switch back.");
      setSwitching(null);
    }
  }

  // Hide entirely unless the caller is authorized (owner / manager with
  // can_manage_settings).
  if (authorized === false || authorized === null) return null;

  const insideTestSession = currentIsTest && !!originalProfileId;

  return (
    <>
      {/* Persistent banner while impersonating a test account */}
      {insideTestSession && (
        <div className="fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-xs font-medium text-white shadow">
          <span>
            Viewing as{" "}
            <strong>
              {accounts.find((a) => a.isCurrent)?.name ?? "test account"}
            </strong>
            {" "}&middot; changes made here affect your real studio.
          </span>
          <button
            type="button"
            onClick={switchBack}
            disabled={switching !== null}
            className="rounded-full bg-white/20 px-2.5 py-0.5 text-white underline-offset-2 hover:bg-white/30 hover:underline disabled:opacity-50"
          >
            Return to your account
          </button>
        </div>
      )}

      {/* Floating button — stacked above the Setup checklist button which
          also lives at bottom-right */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`fixed bottom-20 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-colors ${
          insideTestSession
            ? "bg-amber-600 hover:bg-amber-700"
            : "bg-slate-700 hover:bg-slate-800"
        }`}
        title="Test accounts"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </button>

      {/* Panel — opens upward from the floating button */}
      {open && (
        <div className="fixed bottom-36 right-6 z-50 w-80 rounded-xl border border-gray-200 bg-white shadow-2xl">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Test accounts
                </p>
                <p className="text-xs text-gray-500">
                  {studioName} &middot; experience instructor &amp; member views
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {insideTestSession && (
            <div className="border-b border-gray-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              You&apos;re currently signed in as a test account.
              <button
                type="button"
                onClick={switchBack}
                disabled={switching !== null}
                className="ml-1 font-medium underline hover:no-underline"
              >
                Return to your account
              </button>
            </div>
          )}

          {switchError && (
            <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
              <div className="flex items-start justify-between gap-2">
                <span>{switchError}</span>
                <button
                  type="button"
                  onClick={() => setSwitchError(null)}
                  className="shrink-0 text-red-500 hover:text-red-700"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto p-2">
            {loading ? (
              <p className="py-4 text-center text-sm text-gray-500">
                Loading accounts...
              </p>
            ) : accounts.filter((a) => a.isTest).length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-600">
                <p className="font-medium text-gray-900">No test accounts yet</p>
                <p className="mt-1 text-gray-500">
                  Test accounts let you preview Klasly as an instructor or
                  member without affecting real data.
                </p>
                <a
                  href="/settings#test-accounts"
                  className="mt-2 inline-block font-medium text-brand-600 underline hover:text-brand-700"
                >
                  Create test accounts →
                </a>
              </div>
            ) : (
              <div className="space-y-1">
                {accounts.map((acct) => {
                  const disabled =
                    acct.isCurrent ||
                    !acct.isTest ||
                    switching !== null;
                  return (
                    <button
                      key={acct.id}
                      type="button"
                      onClick={() => switchTo(acct)}
                      disabled={disabled}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        acct.isCurrent
                          ? "bg-amber-50 border border-amber-200"
                          : acct.isTest
                            ? "hover:bg-gray-50"
                            : "opacity-50"
                      } ${switching === acct.id ? "opacity-50" : ""}`}
                      title={
                        acct.isTest
                          ? "Switch to this test account"
                          : "Real account — cannot switch"
                      }
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
                        {acct.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {acct.name}
                          </p>
                          {acct.isCurrent && (
                            <span className="shrink-0 text-xs font-medium text-amber-600">
                              You
                            </span>
                          )}
                          {!acct.isTest && !acct.isCurrent && (
                            <span className="shrink-0 text-[10px] font-medium text-gray-400">
                              Real
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-gray-500">
                          {acct.email}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          ROLE_COLORS[acct.role] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {ROLE_LABELS[acct.role] ?? acct.role}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 px-4 py-2">
            <p className="text-center text-[10px] text-gray-400">
              Currently: {ROLE_LABELS[currentRole] ?? currentRole}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
