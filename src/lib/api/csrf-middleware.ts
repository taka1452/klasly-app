/**
 * Edge Runtime 対応の CSRF 検証ユーティリティ。
 * middleware.ts から使用する。
 *
 * ダブルサブミットクッキーパターン:
 *   クッキー `__csrf` の値と `x-csrf-token` ヘッダーの値を比較。
 */

import { NextRequest, NextResponse } from "next/server";

const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

/** CSRF 検証が不要なパス（prefix match） */
const CSRF_EXEMPT_PREFIXES = [
  "/api/stripe/webhook",
  "/api/cron/",
  "/api/public/",
  "/api/widget/",
  "/api/csrf",
  "/api/instructor-join/",
  "/api/auth/",
];

/** CSRF 検証が不要な完全一致パス */
const CSRF_EXEMPT_EXACT = [
  "/api/waiver/sign",
  "/api/waiver/sign-inline",
  "/api/waiver/guardian-sign",
  "/api/push/subscribe",
];

/**
 * リクエストが CSRF 検証の対象かどうかを判定
 */
function requiresCsrf(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return false;
  }

  const pathname = request.nextUrl.pathname;

  for (const prefix of CSRF_EXEMPT_PREFIXES) {
    if (pathname.startsWith(prefix)) return false;
  }

  for (const exact of CSRF_EXEMPT_EXACT) {
    if (pathname === exact) return false;
  }

  return true;
}

/**
 * Edge Runtime で timing-safe な比較を行う。
 * crypto.subtle を使い、HMAC の一致で比較することで
 * タイミング攻撃を防ぐ。
 */
async function timingSafeCompare(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode("csrf-compare-key"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(a)),
    crypto.subtle.sign("HMAC", key, encoder.encode(b)),
  ]);

  const bufA = new Uint8Array(sigA);
  const bufB = new Uint8Array(sigB);

  if (bufA.length !== bufB.length) return false;

  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

/**
 * CSRF トークンを検証する。
 * @returns null if valid, NextResponse(403) if invalid
 */
export async function validateCsrfInMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  if (!requiresCsrf(request)) return null;

  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;

  if (!headerToken || !cookieToken) {
    return NextResponse.json(
      { error: "Missing CSRF token" },
      { status: 403 }
    );
  }

  const isValid = await timingSafeCompare(headerToken, cookieToken);
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid CSRF token" },
      { status: 403 }
    );
  }

  return null;
}
