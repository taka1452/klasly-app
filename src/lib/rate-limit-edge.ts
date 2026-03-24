/**
 * Edge Runtime 対応のレート制限。
 * middleware.ts から使用する。
 * @upstash/ratelimit は Edge Runtime をサポートしている。
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

let ratelimitInstance: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (ratelimitInstance) return ratelimitInstance;

  // Upstash の環境変数が未設定の場合（ローカル開発など）はスキップ
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }

  ratelimitInstance = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "middleware-rl",
  });

  return ratelimitInstance;
}

/**
 * API リクエストにレート制限を適用する。
 * @returns null if allowed, NextResponse(429) if rate-limited
 */
export async function checkRateLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  // GET リクエストはレート制限しない
  if (request.method === "GET") return null;

  // API ルート以外はスキップ
  if (!request.nextUrl.pathname.startsWith("/api/")) return null;

  const rl = getRatelimit();
  if (!rl) return null;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const { success } = await rl.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  return null;
}
