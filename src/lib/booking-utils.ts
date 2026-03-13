/**
 * 予約クレジット要否の判定ユーティリティ
 *
 * studios.booking_requires_credits の値に基づいて、
 * 予約時にクレジットが必要かどうかを返す。
 *
 * - null (デフォルト): Stripe Connect の導入状況を自動判定
 *   - Stripe Connect 完了 → 必須（オンライン決済が確認可能なため）
 *   - Stripe Connect 未完了 → 不要（現金決済スタジオ想定）
 * - true: 常に必須（手動オーバーライド）
 * - false: 常に不要（手動オーバーライド）
 */
export function getRequiresCredits(studio: {
  booking_requires_credits: boolean | null;
  stripe_connect_onboarding_complete: boolean;
}): boolean {
  if (studio.booking_requires_credits !== null) {
    return studio.booking_requires_credits;
  }
  // 自動判定: Stripe Connect が完了していればクレジット必須
  return studio.stripe_connect_onboarding_complete;
}
