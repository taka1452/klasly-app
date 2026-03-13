"use client";

import { useState } from "react";

export type FlowHintType =
  | "members"
  | "instructors"
  | "stripe-connect"
  | "member-invite"
  | "instructor-assign"
  | "widget-embed";

const FLOWS: Record<
  FlowHintType,
  { title: string; subtitle?: string; steps: { who: string; what: string }[] }
> = {
  members: {
    title: "How members work",
    subtitle: "Who does what — the full flow from adding people to them using the app.",
    steps: [
      { who: "You (owner)", what: "Add a member manually or import from CSV. Optionally send an invite email." },
      { who: "Member", what: "Receives the invite (if sent), signs up or signs in, and signs the waiver if required." },
      { who: "Member", what: "Can book classes and buy drop-ins, packs, or monthly membership from the member portal." },
    ],
  },
  instructors: {
    title: "How instructors work",
    subtitle: "Who does what — the full flow from adding people to them using the app.",
    steps: [
      { who: "You (owner)", what: "Add an instructor with their email. They receive an invite to join." },
      { who: "Instructor", what: "Signs up or signs in and gets access to the Instructor dashboard." },
      { who: "You (owner)", what: "Create classes and assign them to the instructor." },
      { who: "Instructor", what: "Sees their schedule and can mark attendance for sessions." },
    ],
  },
  "stripe-connect": {
    title: "Why Stripe Connect?",
    subtitle: "What it is and what happens when you connect.",
    steps: [
      { who: "Why", what: "To receive payments from members (drop-in, packs, monthly), your studio must be connected to Stripe. Without it, members cannot pay online through the app." },
      { who: "When connected", what: "You connect your own Stripe account. When a member pays, the money goes to your account (Stripe and any platform fee are deducted). You can view payouts in your Stripe Dashboard." },
      { who: "Required?", what: "Yes, if you want to accept online payments from members. If you only take cash or external payments, you can skip connecting." },
    ],
  },
  "member-invite": {
    title: "Where to send an invite",
    subtitle: "How and when the member gets a sign-in link.",
    steps: [
      { who: "When adding a new member", what: "Go to Members → + Add member. Fill in the form and submit. An invite email with a sign-in link is sent to the member automatically — there is no separate “Send invite” button." },
      { who: "Existing members", what: "If a member never received or lost the email, they can use “Forgot password” on the login page, or you can add them again with the same email (the system will use the existing account). For waiver signing, use Settings → Waiver to resend waiver invites." },
    ],
  },
  "instructor-assign": {
    title: "How to assign classes to an instructor",
    subtitle: "Where to set the instructor for each class.",
    steps: [
      { who: "Create or edit a class", what: "Go to Classes, then click + New class to create one, or click an existing class to edit it." },
      { who: "In the form", what: "Find the Instructor dropdown (optional). Select the instructor for this class and save. The instructor will then see this class in their schedule and can mark attendance." },
    ],
  },
  "widget-embed": {
    title: "How to embed on your website",
    subtitle: "Add a live class schedule to your website in 3 simple steps.",
    steps: [
      { who: "You (owner)", what: "Enable the widget and choose a theme color on the Widget settings page." },
      { who: "You (owner)", what: "Copy the embed code and paste it into your website's HTML where you want the schedule to appear. It works with any website builder — WordPress, Wix, Squarespace, or custom HTML." },
      { who: "Visitor / Member", what: "Sees your live class schedule on your website. They can sign in and book classes directly from the embedded widget without leaving your site." },
    ],
  },
};

type FlowHintPanelProps = {
  flowType: FlowHintType;
  className?: string;
  buttonLabel?: string;
};

export default function FlowHintPanel({
  flowType,
  className = "",
  buttonLabel = "How it works",
}: FlowHintPanelProps) {
  const [open, setOpen] = useState(false);
  const flow = FLOWS[flowType];

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
        aria-label={buttonLabel}
      >
        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
                {buttonLabel}
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
              {flow.subtitle && (
                <p className="mb-4 text-sm text-gray-500">
                  {flow.subtitle}
                </p>
              )}
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
