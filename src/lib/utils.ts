// ============================================
// Klasly - Utility Functions
// ============================================

/**
 * 曜日の数値を英語表記に変換
 */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] || "Unknown";
}

/**
 * 金額をセントからドル表記に変換
 * 例: 1900 → "$19.00"
 */
export function formatCurrency(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * 日付を読みやすい形式にフォーマット
 * 例: "2025-02-23" → "Feb 23, 2025"
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * 時刻を12時間表記にフォーマット
 * 例: "09:30:00" → "9:30 AM"
 */
export function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * プランタイプの表示名
 */
export function getPlanLabel(planType: string): string {
  switch (planType) {
    case "monthly":
      return "Monthly";
    case "pack":
      return "Class Pack";
    case "drop_in":
      return "Drop-in";
    default:
      return planType;
  }
}

/**
 * ステータスの表示色（Tailwind クラス名）
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case "active":
    case "confirmed":
    case "paid":
      return "bg-green-100 text-green-800";
    case "paused":
    case "waitlist":
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "cancelled":
    case "failed":
      return "bg-red-100 text-red-800";
    case "refunded":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

/**
 * 残回数の表示
 * -1 = Unlimited (月額プラン)
 */
export function formatCredits(credits: number): string {
  if (credits === -1) return "Unlimited";
  return `${credits} remaining`;
}
