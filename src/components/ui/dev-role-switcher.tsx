"use client";

import { useCallback, useEffect, useState } from "react";

type Account = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "instructor" | "member";
  isCurrent: boolean;
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  instructor: "bg-blue-100 text-blue-700",
  member: "bg-green-100 text-green-700",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  instructor: "Instructor",
  member: "Member",
};

export default function DevRoleSwitcher() {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentRole, setCurrentRole] = useState<string>("");
  const [studioName, setStudioName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState<boolean | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dev/switch-role");
      if (!res.ok) {
        setIsDemo(false);
        return;
      }
      const data = await res.json();
      setIsDemo(true);
      setAccounts(data.accounts ?? []);
      setCurrentRole(data.currentRole ?? "");
      setStudioName(data.studioName ?? "");
    } catch {
      setIsDemo(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  async function switchTo(profileId: string) {
    setSwitching(profileId);
    try {
      const res = await fetch("/api/dev/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProfileId: profileId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to switch");
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      alert("Failed to switch role");
    } finally {
      setSwitching(null);
    }
  }

  // Don't render if not a demo studio
  if (isDemo === false || isDemo === null) return null;

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-colors"
        title="Dev: Switch Role"
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

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-80 rounded-xl border border-amber-200 bg-white shadow-2xl">
          <div className="border-b border-amber-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Dev Role Switcher
                </p>
                <p className="text-xs text-amber-600">{studioName} (Demo)</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-2">
            {loading ? (
              <p className="py-4 text-center text-sm text-gray-500">
                Loading accounts...
              </p>
            ) : (
              <div className="space-y-1">
                {accounts.map((acct) => (
                  <button
                    key={acct.id}
                    type="button"
                    onClick={() => !acct.isCurrent && switchTo(acct.id)}
                    disabled={acct.isCurrent || switching !== null}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      acct.isCurrent
                        ? "bg-amber-50 border border-amber-200"
                        : "hover:bg-gray-50"
                    } ${switching === acct.id ? "opacity-50" : ""}`}
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
                          <span className="shrink-0 text-xs text-amber-600 font-medium">
                            Current
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
                ))}
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
