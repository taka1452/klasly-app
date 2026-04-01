"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ExportCsvButton from "@/components/ui/export-csv-button";
import DashboardCalendar from "./dashboard-calendar";
import AddSessionModal from "./add-session-modal";
import CalendarLegend from "./calendar-legend";
import ContextHelpLink from "@/components/help/context-help-link";

export default function ScheduleActions() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scheduleTemplateId, setScheduleTemplateId] = useState<string | undefined>();
  const [presetDate, setPresetDate] = useState<string | undefined>();
  const [presetStartTime, setPresetStartTime] = useState<string | undefined>();

  // Auto-open modal if ?schedule=TEMPLATE_ID is in URL
  useEffect(() => {
    const scheduleId = searchParams.get("schedule");
    if (scheduleId) {
      setScheduleTemplateId(scheduleId);
      setModalOpen(true);
      // Clean up URL param
      router.replace("/calendar", { scroll: false });
    }
  }, [searchParams, router]);

  const handleCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  function handleClose() {
    setModalOpen(false);
    setScheduleTemplateId(undefined);
    setPresetDate(undefined);
    setPresetStartTime(undefined);
  }

  function handleSlotClick(date: string, startTime: string) {
    setPresetDate(date);
    setPresetStartTime(startTime);
    setModalOpen(true);
  }

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

      <div className="mt-4">
        <CalendarLegend />
      </div>

      <div className="mt-4">
        <DashboardCalendar key={refreshKey} onSlotClick={handleSlotClick} />
      </div>

      <AddSessionModal
        open={modalOpen}
        onClose={handleClose}
        onCreated={handleCreated}
        defaultTemplateId={scheduleTemplateId}
        defaultDate={presetDate}
        defaultStartTime={presetStartTime}
      />
    </>
  );
}
