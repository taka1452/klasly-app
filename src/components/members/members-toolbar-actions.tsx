"use client";

import { useState } from "react";
import Link from "next/link";
import ExportCsvButton from "@/components/ui/export-csv-button";
import OverflowMenu from "@/components/ui/overflow-menu";
import DuplicateMembersModal from "./duplicate-members-modal";

type Props = {
  exportFilename: string;
};

export default function MembersToolbarActions({ exportFilename }: Props) {
  const [showDuplicates, setShowDuplicates] = useState(false);

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={() => setShowDuplicates(true)}
            className="btn-secondary"
          >
            Check Duplicates
          </button>
          <ExportCsvButton url="/api/export/members" filename={exportFilename} />
          <Link href="/members/import" className="btn-secondary">
            Import
          </Link>
        </div>
        <Link href="/members/new" className="btn-primary whitespace-nowrap">
          + Add
        </Link>
        <OverflowMenu
          className="sm:hidden"
          items={[
            { label: "Check Duplicates", onClick: () => setShowDuplicates(true) },
            { label: "Import from CSV", href: "/members/import" },
            {
              label: "Export to CSV",
              render: () => (
                <ExportCsvButton
                  url="/api/export/members"
                  filename={exportFilename}
                  label="Export to CSV"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 transition-colors duration-150 hover:bg-gray-50 disabled:opacity-50"
                />
              ),
            },
          ]}
        />
      </div>
      {showDuplicates && (
        <DuplicateMembersModal onClose={() => setShowDuplicates(false)} />
      )}
    </>
  );
}
