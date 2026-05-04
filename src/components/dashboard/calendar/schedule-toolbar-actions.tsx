"use client";

import Link from "next/link";
import ExportCsvButton from "@/components/ui/export-csv-button";
import OverflowMenu from "@/components/ui/overflow-menu";

type Props = {
  exportFilename: string;
  onAddClick: () => void;
};

/**
 * Mobile-aware action group for /calendar.
 * - sm and up: Export / Print / Import / Classes / + Add inline
 * - below sm: only "+ Add" + a "⋯" overflow menu containing the rest
 */
export default function ScheduleToolbarActions({
  exportFilename,
  onAddClick,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {/* Desktop: full action set inline */}
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <ExportCsvButton
          url="/api/export/classes"
          filename={exportFilename}
          label="Export"
        />
        <Link
          href="/calendar/print"
          target="_blank"
          rel="noopener"
          className="btn-secondary"
        >
          Print
        </Link>
        <Link href="/calendar/import" className="btn-secondary">
          Import
        </Link>
        <Link href="/classes" className="btn-secondary">
          Classes
        </Link>
        <button
          type="button"
          onClick={onAddClick}
          className="btn-primary whitespace-nowrap"
        >
          + Add
        </button>
      </div>
      {/* Mobile: everything (including + Add) tucked into ⋯ — owners
          rarely schedule from a phone, so don't take header real estate. */}
      <OverflowMenu
        className="sm:hidden"
        items={[
          { label: "+ Add session", onClick: onAddClick },
          { label: "Manage classes", href: "/classes" },
          { label: "Import schedule", href: "/calendar/import" },
          { label: "Print schedule", href: "/calendar/print" },
          {
            label: "Export to CSV",
            render: () => (
              <ExportCsvButton
                url="/api/export/classes"
                filename={exportFilename}
                label="Export to CSV"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors duration-150 hover:bg-gray-50 disabled:opacity-50"
              />
            ),
          },
        ]}
      />
    </div>
  );
}
