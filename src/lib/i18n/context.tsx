"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import en from "./locales/en";
import ja from "./locales/ja";

export type Locale = "en" | "ja";

const locales: Record<Locale, Record<string, string>> = { en, ja };

type I18nContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({
  children,
  defaultLocale = "en",
}: {
  children: ReactNode;
  defaultLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    // Persist to cookie
    document.cookie = `klasly-locale=${newLocale};path=/;max-age=31536000`;
  }, []);

  const t = useCallback(
    (key: string): string => {
      return locales[locale]?.[key] || locales.en[key] || key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
