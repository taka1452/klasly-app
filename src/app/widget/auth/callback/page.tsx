"use client";

import { useEffect, useState } from "react";
import { createWidgetClient } from "@/lib/widget/supabase-client";

/**
 * OAuth ポップアップからのコールバック。
 * 認証後にセッション情報を親ウィンドウ (iframe) へ postMessage で返す。
 */
export default function WidgetAuthCallbackPage() {
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing"
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function handleCallback() {
      try {
        const supabase = createWidgetClient();

        // URL hash からセッション情報を取得（Supabase が自動処理）
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session) {
          setStatus("error");
          setErrorMessage(
            error?.message || "Failed to retrieve session."
          );
          return;
        }

        // 親ウィンドウ（iframe）に postMessage でセッションを送る
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "KLASLY_AUTH_CALLBACK",
              session: {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
              },
            },
            "*"
          );
          setStatus("success");
          // 少し待ってからポップアップを閉じる
          setTimeout(() => window.close(), 1500);
        } else {
          // ポップアップではなく直接開かれた場合
          setStatus("success");
        }
      } catch {
        setStatus("error");
        setErrorMessage("An unexpected error occurred.");
      }
    }

    handleCallback();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-lg">
        {status === "processing" && (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
            <p className="text-sm text-gray-600">
              Completing sign in...
            </p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">
              Signed in successfully!
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {window.opener
                ? "This window will close automatically."
                : "You can now return to the booking widget."}
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
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
            <p className="text-sm font-medium text-gray-900">
              Sign in failed
            </p>
            <p className="mt-1 text-xs text-red-600">{errorMessage}</p>
          </>
        )}
      </div>
    </div>
  );
}
