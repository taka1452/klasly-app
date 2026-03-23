import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "crypto";

const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const TOKEN_BYTES = 32;

/**
 * CSRFトークンを生成し、HttpOnlyクッキーにセットする。
 * Server Component / API GET ルートから呼び出し、トークン値をクライアントに返す。
 */
export async function generateCsrfToken(): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });
  return token;
}

/**
 * リクエストのCSRFトークンを検証する。
 * x-csrf-token ヘッダーの値と HttpOnly クッキーの値を比較。
 * 不一致の場合は 403 レスポンスを返す。
 *
 * @returns null if valid, NextResponse(403) if invalid
 */
export async function validateCsrfToken(
  request: Request
): Promise<NextResponse | null> {
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  if (!headerToken || !cookieToken) {
    return NextResponse.json(
      { error: "Missing CSRF token" },
      { status: 403 }
    );
  }

  const headerBuf = Buffer.from(headerToken, "utf-8");
  const cookieBuf = Buffer.from(cookieToken, "utf-8");

  if (
    headerBuf.length !== cookieBuf.length ||
    !timingSafeEqual(headerBuf, cookieBuf)
  ) {
    return NextResponse.json(
      { error: "Invalid CSRF token" },
      { status: 403 }
    );
  }

  return null;
}

/**
 * CSRF保護のヘッダー名。
 * クライアントはこのヘッダーにトークンを含めてリクエストする。
 */
export { CSRF_HEADER_NAME };
