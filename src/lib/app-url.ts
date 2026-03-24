/**
 * アプリの正規URL（マジックリンク・リダイレクト用）。
 * 本番: NEXT_PUBLIC_APP_URL または Vercel の VERCEL_URL。ローカル: localhost。
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

/**
 * リダイレクト先のパスを安全に検証する。
 * open redirect を防止するため、パスが `/` で始まり `//` を含まないことを確認。
 * 無効な場合はフォールバックパスを返す。
 */
export function sanitizeRedirectPath(
  path: string | null | undefined,
  fallback = "/"
): string {
  if (!path) return fallback;
  // `/` で始まること、`//` や プロトコル相対URLを含まないこと
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return fallback;
  }
  return path;
}
