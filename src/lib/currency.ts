/**
 * 多通貨対応ユーティリティ
 * スタジオごとの通貨設定をサポート。
 */

export const SUPPORTED_CURRENCIES = [
  { code: "usd", label: "USD ($)", symbol: "$" },
  { code: "cad", label: "CAD (CA$)", symbol: "CA$" },
  { code: "aud", label: "AUD (A$)", symbol: "A$" },
  { code: "gbp", label: "GBP (£)", symbol: "£" },
  { code: "eur", label: "EUR (€)", symbol: "€" },
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

const symbolMap: Record<string, string> = Object.fromEntries(
  SUPPORTED_CURRENCIES.map((c) => [c.code, c.symbol])
);

/**
 * 通貨コードから記号を取得。未知の通貨はコードをそのまま大文字で返す。
 */
export function getCurrencySymbol(currency: string): string {
  return symbolMap[currency.toLowerCase()] ?? currency.toUpperCase();
}
