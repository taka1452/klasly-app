"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ExportCsvButton from "@/components/ui/export-csv-button";
import DashboardCalendar from "./dashboard-calendar";
import AddSessionModal from "./add-session-modal";
import CalendarLegend from "./calendar-legend";
import ContextHelpLink from "@/components/help/context-help-link";

const TIP_KEY = "klasly:schedule:tips-dismissed";

export default function ScheduleActions() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scheduleTemplateId, setScheduleTemplateId] = useState<string | undefined>();
  const [presetDate, setPresetDate] = useState<string | undefined>();
  const [presetStartTime, setPresetStartTime] = useState<string | undefined>();

  // Show tip once until dismissed
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(TIP_KEY)) {
      setShowTip(true);
    }
  }, []);

  function dismissTip() {
    setShowTip(false);
    if (typeof window !== "undefined") localStorage.setItem(TIP_KEY, "1");
  }

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

      {showTip && (
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="font-medium">Quick tips for this calendar</p>
            <ul className="mt-1 list-disc pl-4 text-brand-700 space-y-0.5">
              <li><strong>Click any empty time slot</strong> in Week or Day view to instantly schedule a session at that time.</li>
              <li>Switch to <strong>List view</strong> for a scrollable date-by-date summary of all sessions.</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={dismissTip}
            className="shrink-0 rounded p-1 text-brand-400 hover:bg-brand-100 hover:text-brand-700"
            aria-label="Dismiss tip"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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
