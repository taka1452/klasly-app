import { NextResponse } from "next/server";
import { generateCsrfToken } from "@/lib/api/csrf";

/**
 * CSRFトークンを発行する GET エンドポイント。
 * クライアントはアプリ起動時にこのエンドポイントからトークンを取得し、
 * 以降の POST/PATCH/DELETE リクエストで x-csrf-token ヘッダーに付与する。
 */
export async function GET() {
  const token = await generateCsrfToken();
  return NextResponse.json({ csrfToken: token });
}
