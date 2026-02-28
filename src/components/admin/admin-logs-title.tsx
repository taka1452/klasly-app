"use client";

import { useAdminLocale } from "@/lib/admin/locale-context";

export default function AdminLogsTitle() {
  const { t } = useAdminLocale();
  return (
    <>
      <h1 className="text-2xl font-bold text-white">{t("logs.title")}</h1>
      <p className="text-slate-400">{t("logs.subtitle")}</p>
    </>
  );
}
