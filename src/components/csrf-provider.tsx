"use client";

import { useEffect } from "react";

const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const MUTATION_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * グローバル fetch をラップし、mutation リクエストに
 * CSRF トークン（クッキーから取得）を自動付与する。
 *
 * ダブルサブミットクッキーパターン:
 *   サーバー側でセットされた HttpOnly=false のクッキーの値を
 *   x-csrf-token ヘッダーにコピーして送信する。
 */
function getCsrfTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match ? match.split("=")[1] : null;
}

let patched = false;

function patchGlobalFetch() {
  if (patched) return;
  patched = true;

  const originalFetch = window.fetch;

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const method = (init?.method ?? "GET").toUpperCase();

    if (!MUTATION_METHODS.includes(method)) {
      return originalFetch(input, init);
    }

    const token = getCsrfTokenFromCookie();
    if (!token) {
      // トークン未取得の場合はまず取得を試みる
      try {
        const res = await originalFetch("/api/csrf");
        if (res.ok) {
          const data = await res.json();
          // サーバー側でクッキーがセットされるので、再度読み取り
          const newToken = getCsrfTokenFromCookie() || data.csrfToken;
          if (newToken) {
            const headers = new Headers(init?.headers);
            headers.set(CSRF_HEADER_NAME, newToken);
            return originalFetch(input, { ...init, headers });
          }
        }
      } catch {
        // フォールバック: トークンなしで送信
      }
      return originalFetch(input, init);
    }

    const headers = new Headers(init?.headers);
    headers.set(CSRF_HEADER_NAME, token);
    return originalFetch(input, { ...init, headers });
  };
}

/**
 * アプリ初期化時に CSRF トークンを取得し、
 * グローバル fetch を CSRF 付与版にラップするプロバイダー。
 *
 * layout.tsx の <body> 内に配置する。
 */
export default function CsrfProvider() {
  useEffect(() => {
    patchGlobalFetch();

    // 初回トークン取得（クッキーにセットされる）
    if (!getCsrfTokenFromCookie()) {
      fetch("/api/csrf").catch(() => {});
    }
  }, []);

  return null;
}
