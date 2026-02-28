"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  type AdminLocale,
  getLocale,
  setLocale as persistLocale,
  getTranslation,
  formatDate as formatDateI18n,
  formatDateTime as formatDateTimeI18n,
} from "./i18n";

type AdminLocaleContextValue = {
  locale: AdminLocale;
  setLocale: (locale: AdminLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (date: string | Date) => string;
  formatDateTime: (date: string | Date) => string;
};

const AdminLocaleContext = createContext<AdminLocaleContextValue | null>(null);

export function AdminLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>("ja");

  useEffect(() => {
    setLocaleState(getLocale());
  }, []);

  const setLocale = useCallback((next: AdminLocale) => {
    persistLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      getTranslation(locale, key, params),
    [locale]
  );

  const formatDate = useCallback(
    (date: string | Date) => formatDateI18n(locale, date),
    [locale]
  );

  const formatDateTime = useCallback(
    (date: string | Date) => formatDateTimeI18n(locale, date),
    [locale]
  );

  return (
    <AdminLocaleContext.Provider
      value={{ locale, setLocale, t, formatDate, formatDateTime }}
    >
      {children}
    </AdminLocaleContext.Provider>
  );
}

export function useAdminLocale(): AdminLocaleContextValue {
  const ctx = useContext(AdminLocaleContext);
  if (!ctx) {
    throw new Error("useAdminLocale must be used within AdminLocaleProvider");
  }
  return ctx;
}
