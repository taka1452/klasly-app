"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createWidgetClient } from "@/lib/widget/supabase-client";

const ALLOWED_PATHS = [
  "/my-passes",
  "/my-bookings",
  "/my-payments",
  "/dashboard",
  "/account",
];

function isSafeRedirect(target: string | null): string {
  if (!target) return "/dashboard";
  // Only allow same-origin paths from a known allowlist to prevent
  // open-redirect via the `next` query param.
  if (!target.startsWith("/")) return "/dashboard";
  const path = target.split("?")[0];
  if (!ALLOWED_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    return "/dashboard";
  }
  return target;
}

function SyncContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"working" | "redirecting" | "error">(
    "working"
  );
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const next = isSafeRedirect(searchParams.get("next"));

    (async () => {
      try {
        const supabase = createWidgetClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token || !session?.refresh_token) {
          setStatus("error");
          setMessage(
            "You need to sign in to the studio first. Please return to the booking page."
          );
          return;
        }

        const res = await fetch("/api/widget/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        });

        if (!res.ok) {
          setStatus("error");
          setMessage(
            "We couldn't transfer your session. Please sign in again."
          );
          return;
        }

        setStatus("redirecting");
        setMessage("Taking you there…");
        window.location.replace(next);
      } catch {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    })();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm">
        {status !== "error" && (
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
        )}
        {status === "error" && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        )}
        <p className="text-sm font-medium text-gray-900">{message}</p>
        {status === "error" && (
          <p className="mt-4 text-xs text-gray-500">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="font-medium text-brand-600 underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
            >
              ← Back to the previous page
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default function WidgetAuthSyncPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
        </div>
      }
    >
      <SyncContent />
    </Suspense>
  );
}
