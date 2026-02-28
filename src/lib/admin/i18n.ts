/**
 * Admin画面専用の翻訳システム
 * ユーザー向け画面（Owner/Instructor/Member）には影響しない
 */

import { ja } from "./locales/ja";
import { en } from "./locales/en";

const STORAGE_KEY = "klasly-admin-locale";

export type AdminLocale = "ja" | "en";

const dictionaries: Record<AdminLocale, Record<string, unknown>> = { ja, en };

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * 現在の言語の翻訳を返す。キーが見つからない場合は英語にフォールバック、英語にもない場合はキー自体を返す。
 */
export function getTranslation(
  locale: AdminLocale,
  key: string,
  params?: Record<string, string | number>
): string {
  let value =
    getNested(dictionaries[locale] as Record<string, unknown>, key) ??
    getNested(dictionaries.en as Record<string, unknown>, key) ??
    key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp("\\{\\{" + k + "\\}\\}", "g"), String(v));
    }
  }
  return value;
}

/**
 * 翻訳を返す（現在のlocaleはContext経由で渡す想定）。interpolation用にparamsをサポート。
 */
export function t(
  locale: AdminLocale,
  key: string,
  params?: Record<string, string | number>
): string {
  return getTranslation(locale, key, params);
}

/**
 * localStorageから言語を取得。なければ 'ja'
 */
export function getLocale(): AdminLocale {
  if (typeof window === "undefined") return "ja";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "ja") return stored;
  return "ja";
}

/**
 * localStorageに言語を保存
 */
export function setLocale(locale: AdminLocale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, locale);
}

/**
 * 日付フォーマット: 日本語 2026/02/28、英語 Feb 28, 2026
 */
export function formatDate(locale: AdminLocale, dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (locale === "ja") {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * 日時フォーマット: 日本語 2026/02/28 14:30、英語 Feb 28, 2026, 2:30 PM
 */
export function formatDateTime(locale: AdminLocale, dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (locale === "ja") {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${h}:${min}`;
  }
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
