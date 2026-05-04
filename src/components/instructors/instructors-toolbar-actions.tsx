"use client";

import Link from "next/link";
import ExportCsvButton from "@/components/ui/export-csv-button";
import OverflowMenu from "@/components/ui/overflow-menu";

type Props = {
  exportFilename: string;
};

/**
 * Mobile-aware action group for the Instructors page.
 * - sm and up: Export / Earnings / Tax / Import / + Add inline
 * - below sm: only "+ Add" + a "⋯" overflow menu containing the rest
 */
export default function InstructorsToolbarActions({ exportFilename }: Props) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <ExportCsvButton
          url="/api/export/instructors"
          filename={exportFilename}
          label="Export"
        />
        <Link href="/instructors/earnings" className="btn-secondary">
          Earnings
        </Link>
        <Link href="/instructors/tax-report" className="btn-secondary">
          Tax
        </Link>
        <Link href="/instructors/import" className="btn-secondary">
          Import
        </Link>
      </div>
      <Link href="/instructors/new" className="btn-primary whitespace-nowrap">
        + Add
      </Link>
      <OverflowMenu
        className="sm:hidden"
        items={[
          { label: "Earnings", href: "/instructors/earnings" },
          { label: "Tax report", href: "/instructors/tax-report" },
          { label: "Import from CSV", href: "/instructors/import" },
          {
            label: "Export to CSV",
            render: () => (
              <ExportCsvButton
                url="/api/export/instructors"
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
