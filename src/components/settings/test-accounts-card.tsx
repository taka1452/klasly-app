"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, Users } from "lucide-react";

type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  isCurrent: boolean;
  isTest: boolean;
  defaultPassword?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  instructor: "Instructor",
  member: "Member",
};

export default function TestAccountsCard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/dev/switch-role");
      if (!res.ok) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setAuthorized(true);
      setAccounts(data.accounts ?? []);
    } catch {
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  async function copyValue(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      // ignore
    }
  }

  if (authorized === false) return null;

  const testAccounts = accounts.filter((a) => a.isTest);

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Test Accounts</h3>
          <p className="mt-1 text-sm text-gray-600">
            Use these accounts to experience the instructor and member side of
            the app without impersonating real users. You can switch into any
            of them from the person icon at the bottom-right of the screen.
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-gray-400">Loading...</p>
          ) : testAccounts.length === 0 ? (
            <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
              No test accounts set up yet. They&apos;re created automatically
              when you complete studio onboarding.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {testAccounts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {a.name}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {ROLE_LABELS[a.role] ?? a.role}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => copyValue(`email-${a.id}`, a.email)}
                      className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs hover:bg-gray-100"
                    >
                      <span className="truncate font-mono text-gray-700">
                        {a.email}
                      </span>
                      {copied === `email-${a.id}` ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      )}
                    </button>
                    {a.defaultPassword ? (
                      <button
                        type="button"
                        onClick={() =>
                          copyValue(
                            `pass-${a.id}`,
                            a.defaultPassword as string
                          )
                        }
                        className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs hover:bg-gray-100"
                      >
                        <span className="truncate font-mono text-gray-700">
                          {a.defaultPassword}
                        </span>
                        {copied === `pass-${a.id}` ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-200 px-2.5 py-1.5 text-xs text-gray-400">
                        Password not stored
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                <strong>Note:</strong> Test accounts cannot start real Stripe
                charges or subscriptions. Checkout and billing actions are
                blocked for them to protect real money movement.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
