"use client";

import { useI18n, type Locale } from "@/lib/i18n/context";

export default function LanguageSelector() {
  const { locale, setLocale } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600"
    >
      <option value="en">EN</option>
      <option value="ja">JA</option>
    </select>
  );
}
