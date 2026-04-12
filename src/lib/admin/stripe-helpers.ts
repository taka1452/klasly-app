import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { logger } from "@/lib/logger";

/**
 * Stripe API エラーから resource_missing を判定し、
 * それ以外のエラーの場合は 502 レスポンスを返すヘルパー。
 *
 * @returns null なら「無視して続行可」、NextResponse なら「そのまま返すべきエラー」
 */
export function handleStripeResourceError(
  err: unknown,
  context: string
): NextResponse | null {
  const code = (err as { code?: string })?.code;
  if (code === "resource_missing") {
    return null; // 既にキャンセル/削除済み — 続行 OK
  }
  const message = err instanceof Error ? err.message : "Stripe API error";
  logger.error(`[Admin] ${context}`, { error: message });
  return NextResponse.json(
    { error: `Stripe error: ${message}` },
    { status: 502 }
  );
}

/**
 * Stripe subscription をキャンセルする。
 * resource_missing（既にキャンセル済み）は成功扱い。
 *
 * @returns null なら成功、NextResponse ならエラー（呼び出し元がそのまま return する）
 */
export async function cancelSubscriptionSafe(
  subscriptionId: string,
  context: string
): Promise<NextResponse | null> {
  const stripe = getStripe();
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    return null;
  } catch (err) {
    return handleStripeResourceError(err, context);
  }
}
