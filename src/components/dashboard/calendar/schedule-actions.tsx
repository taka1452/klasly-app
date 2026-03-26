"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import ExportCsvButton from "@/components/ui/export-csv-button";
import DashboardCalendar from "./dashboard-calendar";
import AddSessionModal from "./add-session-modal";

export default function ScheduleActions() {
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <>
      <div className="flex gap-2">
        <ExportCsvButton
          url="/api/export/classes"
          filename={`classes-${new Date().toISOString().slice(0, 10)}.csv`}
          label="Export"
        />
        <Link href="/calendar/import" className="btn-secondary">
          Import
        </Link>
        <Link href="/classes" className="btn-secondary">
          Classes
        </Link>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-primary"
        >
          + Add
        </button>
      </div>

      <div className="mt-6">
        <DashboardCalendar key={refreshKey} />
      </div>

      <AddSessionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
