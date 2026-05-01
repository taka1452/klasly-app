"use client";

import { useState } from "react";
import { useViewerPermissions } from "@/lib/auth/viewer-context";

type Props = {
  url: string;
  filename: string;
  label?: string;
  className?: string;
};

export default function ExportCsvButton({ url, filename, label = "Export CSV", className }: Props) {
  const [loading, setLoading] = useState(false);
  // Managers without the Export Your Data permission shouldn't see CSV/PDF
  // download triggers. Owners and instructors are unaffected; instructors
  // never render this button anyway. (Jamie feedback 2026-04-30: Sarah
  // toggled Export Data on for me, but I still don't see export controls.)
  const { canExportData } = useViewerPermissions();
  if (!canExportData) return null;

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch {
      // silent fail or could toast
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={className ?? "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"}
    >
      {loading ? "..." : label}
    </button>
  );
}
