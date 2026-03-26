"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import ExportCsvButton from "@/components/ui/export-csv-button";
import DashboardCalendar from "./dashboard-calendar";
import AddSessionModal from "./add-session-modal";
import ContextHelpLink from "@/components/help/context-help-link";

export default function ScheduleActions() {
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">
            View all sessions and room bookings
          </p>
          <ContextHelpLink href="/help/classes-scheduling/edit-cancel-session" />
        </div>
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
