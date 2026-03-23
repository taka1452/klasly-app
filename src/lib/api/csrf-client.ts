/**
 * クライアントサイド CSRF トークン管理。
 * アプリ起動時にトークンを取得し、mutation リクエストに自動的に付与する。
 */

let csrfToken: string | null = null;
let fetchingPromise: Promise<string> | null = null;

/**
 * CSRFトークンを取得する。キャッシュ済みならそれを返す。
 */
async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  // 同時リクエストの重複を防ぐ
  if (fetchingPromise) return fetchingPromise;

  fetchingPromise = fetch("/api/csrf")
    .then((res) => res.json())
    .then((data: { csrfToken: string }) => {
      csrfToken = data.csrfToken;
      fetchingPromise = null;
      return csrfToken;
    })
    .catch((err) => {
      fetchingPromise = null;
      console.error("[CSRF] Failed to fetch token:", err);
      return "";
    });

  return fetchingPromise;
}

/**
 * CSRFトークンをリセットする。
 * 403 レスポンス時に再取得するために使用。
 */
export function resetCsrfToken(): void {
  csrfToken = null;
}

/**
 * CSRF保護付きの fetch ラッパー。
 * POST/PUT/PATCH/DELETE リクエストに自動的に x-csrf-token ヘッダーを付与する。
 *
 * @example
 * import { csrfFetch } from "@/lib/api/csrf-client";
 * const res = await csrfFetch("/api/bookings", {
 *   method: "POST",
 *   body: JSON.stringify({ sessionId }),
 * });
 */
export async function csrfFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const needsCsrf = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (!needsCsrf) {
    return fetch(input, init);
  }

  const token = await getCsrfToken();

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("x-csrf-token", token);
  }
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(input, { ...init, headers });

  // 403 で CSRF token 切れの可能性 → リセットして再試行
  if (res.status === 403 && token) {
    const body = await res.clone().json().catch(() => null);
    if (body?.error === "Invalid CSRF token" || body?.error === "Missing CSRF token") {
      resetCsrfToken();
      const newToken = await getCsrfToken();
      headers.set("x-csrf-token", newToken);
      return fetch(input, { ...init, headers });
    }
  }

  return res;
}
