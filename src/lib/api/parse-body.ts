import { z } from "zod";
import { NextResponse } from "next/server";

/**
 * リクエストボディを安全にパースし、Zodスキーマでバリデーションする。
 * パースやバリデーションに失敗した場合はエラーレスポンスを返す。
 *
 * @example
 * const schema = z.object({ action: z.enum(["replay", "mark_complete"]) });
 * const result = await parseBody(request, schema);
 * if (result instanceof NextResponse) return result;
 * const { action } = result;
 */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T> | NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation error",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  return parsed.data;
}
