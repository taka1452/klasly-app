"use client";

import { useState } from "react";

export type FlowHintType = "members" | "instructors";

const MEMBERS_FLOW = {
  title: "How members work",
  steps: [
    { who: "You (owner)", what: "Add a member manually or import from CSV. Optionally send an invite email." },
    { who: "Member", what: "Receives the invite (if sent), signs up or signs in, and signs the waiver if required." },
    { who: "Member", what: "Can book classes and buy drop-ins, packs, or monthly membership from the member portal." },
  ],
};

const INSTRUCTORS_FLOW = {
  title: "How instructors work",
  steps: [
    { who: "You (owner)", what: "Add an instructor with their email. They receive an invite to join." },
    { who: "Instructor", what: "Signs up or signs in and gets access to the Instructor dashboard." },
    { who: "You (owner)", what: "Create classes and assign them to the instructor." },
    { who: "Instructor", what: "Sees their schedule and can mark attendance for sessions." },
  ],
};

type FlowHintPanelProps = {
  flowType: FlowHintType;
  className?: string;
};

export default function FlowHintPanel({ flowType, className = "" }: FlowHintPanelProps) {
  const [open, setOpen] = useState(false);
  const flow = flowType === "members" ? MEMBERS_FLOW : INSTRUCTORS_FLOW;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
        aria-label="How it works"
      >
        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
        How it works
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[9999] bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="fixed right-0 top-0 z-[10000] h-full w-full max-w-md overflow-y-auto border-l border-gray-200 bg-white shadow-xl transition-transform duration-200 ease-out"
            role="dialog"
            aria-modal="true"
            aria-labelledby="flow-hint-title"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
              <h2 id="flow-hint-title" className="text-lg font-semibold text-gray-900">
                {flow.title}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <p className="mb-4 text-sm text-gray-500">
                Who does what — the full flow from adding people to them using the app.
              </p>
              <ol className="space-y-4">
                {flow.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{step.who}</p>
                      <p className="mt-0.5 text-sm text-gray-600">{step.what}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
