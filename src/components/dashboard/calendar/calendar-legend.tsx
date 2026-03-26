"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const legendItems = [
  {
    color: "bg-brand-500",
    bg: "bg-brand-50",
    label: "Open",
    description: "Public session with spots available",
  },
  {
    color: "bg-amber-500",
    bg: "bg-amber-50",
    label: "Full",
    description: "All spots are booked",
  },
  {
    color: "bg-violet-500",
    bg: "bg-violet-50",
    label: "Private",
    description: "Hidden from members",
  },
  {
    color: "bg-teal-500",
    bg: "bg-teal-50",
    label: "Room",
    description: "Instructor room booking",
  },
  {
    color: "bg-gray-300",
    bg: "bg-gray-50",
    label: "Cancelled",
    description: "Session has been cancelled",
  },
];

export default function CalendarLegend() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap">
          {legendItems.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-sm ${item.color}`}
              />
              <span className="text-xs text-gray-500">{item.label}</span>
            </span>
          ))}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 ml-2" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-start gap-2.5">
              <div
                className={`mt-0.5 flex h-5 w-8 shrink-0 items-center rounded border-l-[3px] ${item.bg}`}
                style={{
                  borderColor: "inherit",
                }}
              >
                <span
                  className={`h-full w-[3px] rounded-l ${item.color}`}
                  style={{ marginLeft: "-3px" }}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700">
                  {item.label}
                </p>
                <p className="text-xs text-gray-400">{item.description}</p>
              </div>
            </div>
          ))}
          <div className="sm:col-span-2 mt-1 text-xs text-gray-400">
            Click any session to view details. The red line shows the current time.
          </div>
        </div>
      )}
    </div>
  );
}
