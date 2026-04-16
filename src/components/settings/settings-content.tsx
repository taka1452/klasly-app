"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTourActions } from "@/components/tour/TourProvider";
import Toast from "@/components/ui/toast";
import FlowHintPanel from "@/components/ui/flow-hint-panel";
import BookingSettingsCard from "@/components/settings/booking-settings-card";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

type Props = {
  fullName: string;
  email: string;
  bookingRequiresCredits: boolean | null;
  stripeConnectComplete: boolean;
  isAlsoInstructor: boolean;
  sessionGenerationWeeks: number;
  role?: "owner" | "manager";
  canTeach?: boolean;
  canManageSettings?: boolean;
  studioName?: string;
  studioCurrency?: string;
};

const WEEKS_OPTIONS = [4, 6, 8, 12];

export default function SettingsContent({
  fullName,
  email,
  bookingRequiresCredits,
  stripeConnectComplete,
  isAlsoInstructor,
  sessionGenerationWeeks,
  role = "owner",
  canTeach = false,
  canManageSettings = false,
  studioName = "",
  studioCurrency = "usd",
}: Props) {
  const isOwner = role === "owner";
  const router = useRouter();
  const tourActions = useTourActions();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showMarkCompleteConfirm, setShowMarkCompleteConfirm] = useState(false);
  const [markCompleteLoading, setMarkCompleteLoading] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [instructorEnabled, setInstructorEnabled] = useState(isAlsoInstructor);
  const [instructorToggleLoading, setInstructorToggleLoading] = useState(false);
  const [genWeeks, setGenWeeks] = useState(sessionGenerationWeeks);
  const [genWeeksLoading, setGenWeeksLoading] = useState(false);
  const [currency, setCurrency] = useState(studioCurrency);
  const [currencyLoading, setCurrencyLoading] = useState(false);

  function showToast(msg: string) {
    setToastMessage(msg);
  }

  async function handleCurrencyChange(newCurrency: string) {
    setCurrencyLoading(true);
    try {
      const res = await fetch("/api/studio/currency", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: newCurrency }),
      });
      if (!res.ok) throw new Error("Failed to update currency");
      setCurrency(newCurrency);
      showToast("Currency updated");
      router.refresh();
    } catch {
      showToast("Failed to update currency");
    } finally {
      setCurrencyLoading(false);
    }
  }

  async function handleExport() {
    const res = await fetch("/api/account/export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "klasly-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleInstructorToggle() {
    setInstructorToggleLoading(true);
    try {
      const action = instructorEnabled ? "disable" : "enable";
      const res = await fetch("/api/account/instructor-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Failed to update");
        return;
      }
      setInstructorEnabled(data.enabled);
      showToast(data.enabled ? "You are now also an instructor" : "Instructor mode disabled");
      router.refresh();
    } finally {
      setInstructorToggleLoading(false);
    }
  }

  async function handleGenWeeksChange(weeks: number) {
    setGenWeeksLoading(true);
    try {
      const res = await fetch("/api/studio/schedule-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_generation_weeks: weeks }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Failed to update");
        return;
      }
      setGenWeeks(weeks);
      showToast(`Sessions will be generated ${weeks} weeks ahead`);
    } finally {
      setGenWeeksLoading(false);
    }
  }

  async function handleReplayTutorial() {
    setReplayLoading(true);
    try {
      const res = await fetch("/api/account/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "replay" }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Failed to replay tutorial");
        return;
      }
      showToast("Tutorial will restart");
      tourActions?.restartTour();
    } finally {
      setReplayLoading(false);
    }
  }

  async function handleMarkComplete() {
    setMarkCompleteLoading(true);
    try {
      const res = await fetch("/api/account/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_complete" }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Failed to mark complete");
        return;
      }
      setShowMarkCompleteConfirm(false);
      showToast("Tutorial marked as complete");
      router.refresh();
    } finally {
      setMarkCompleteLoading(false);
    }
  }

  async function handleDelete() {
    // スタジオ名の入力確認
    if (deleteConfirmInput !== studioName) {
      showToast("Please type the studio name exactly to confirm");
      return;
    }

    setDeleteLoading(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Failed to delete account");
      setDeleteLoading(false);
      return;
    }

    window.location.href = "/login";
  }

  return (
    <div className="mt-8 space-y-10">
      {/* ── Payments & Pricing ── */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Payments &amp; Pricing
        </h2>
        <div className="space-y-6">
          {/* Stripe Connect — owner only */}
          {isOwner && (
            <div className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Stripe Connect
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Connect your Stripe account to receive payments from members
                    (drop-in, packs, monthly).
                  </p>
                </div>
                <FlowHintPanel
                  flowType="stripe-connect"
                  buttonLabel="Why Stripe Connect?"
                />
              </div>
              <Link
                href="/settings/connect"
                className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Stripe Connect →
              </Link>
            </div>
          )}

          {/* Studio Currency — owner only */}
          {isOwner && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900">
                Studio Currency
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Set the currency for all member-facing pricing (classes, passes, events).
                This must match your Stripe account&apos;s currency.
              </p>
              <select
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                disabled={currencyLoading}
                className="input-field mt-3 max-w-xs"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Class Pricing — owner only */}
          {isOwner && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900">
                Class Pricing
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Set prices for drop-in, class packs, and monthly membership.
              </p>
              <Link
                href="/settings/pricing"
                className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Class Pricing →
              </Link>
            </div>
          )}

          {/* Payout Settings — owner only */}
          {isOwner && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900">Payout</h3>
              <p className="mt-2 text-sm text-gray-600">
                Configure payment distribution to instructors. Choose between
                studio payout or instructor direct payout.
              </p>
              <Link
                href="/settings/payout"
                className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Payout Settings →
              </Link>
            </div>
          )}

          {/* Booking Credit Requirement — owner only */}
          {isOwner && (
            <BookingSettingsCard
              bookingRequiresCredits={bookingRequiresCredits}
              stripeConnectComplete={stripeConnectComplete}
            />
          )}
        </div>
      </section>

      {/* ── Scheduling — owner or manager with settings permission ── */}
      {(isOwner || canManageSettings) && (
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Scheduling
          </h2>
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900">
                Schedule Generation
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Choose how far ahead sessions are automatically generated for your classes.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <label htmlFor="gen-weeks" className="text-sm font-medium text-gray-700">
                  Auto-generate sessions:
                </label>
                <select
                  id="gen-weeks"
                  value={genWeeks}
                  onChange={(e) => handleGenWeeksChange(Number(e.target.value))}
                  disabled={genWeeksLoading}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                >
                  {WEEKS_OPTIONS.map((w) => (
                    <option key={w} value={w}>
                      {w} weeks ahead
                    </option>
                  ))}
                </select>
                {genWeeksLoading && (
                  <span className="text-xs text-gray-400">Saving…</span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Studio Features ── */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Studio Features
        </h2>
        <div className="space-y-6">
          {/* Features Toggle Page — owner only */}
          {isOwner && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900">Features</h3>
              <p className="mt-2 text-sm text-gray-600">
                Enable or disable optional features like Online Classes, SOAP Notes, UTM Tracking, and more.
              </p>
              <Link
                href="/settings/features"
                className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Manage Features &rarr;
              </Link>
            </div>
          )}

          {/* Collective Mode Setup — owner or manager with settings permission */}
          {(isOwner || canManageSettings) && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900">
                Collective Mode Setup
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Step-by-step guide for setting up your shared studio: rooms, tiers, fees, and instructor invitations.
              </p>
              <Link
                href="/settings/collective-setup"
                className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Open Setup Guide &rarr;
              </Link>
            </div>
          )}

          {/* I Also Teach Classes — owner or manager with can_teach */}
          {(isOwner || canTeach) && (
            <div className="card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    I Also Teach Classes
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Enable this to create and manage your own classes as an
                    instructor. You&apos;ll see a &quot;My Classes&quot; section in the sidebar.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={instructorEnabled}
                  disabled={instructorToggleLoading}
                  onClick={handleInstructorToggle}
                  className={`relative mt-1 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 ${
                    instructorEnabled ? "bg-brand-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      instructorEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Instructor Tiers — owner or manager with settings permission */}
          {(isOwner || canManageSettings) && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900">
                Instructor Membership Tiers
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Define tiers with monthly hour limits for instructor room bookings.
              </p>
              <Link
                href="/settings/tiers"
                className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Manage Tiers →
              </Link>
            </div>
          )}

          {/* Waiver — owner + manager */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900">Waiver</h3>
            <p className="mt-2 text-sm text-gray-600">
              Set up your liability waiver and track signing status.
            </p>
            <Link
              href="/settings/waiver"
              className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Waiver Settings →
            </Link>
          </div>

          {/* Website Widget — owner + manager */}
          <div className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Website Widget
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Embed your class schedule on your website so visitors can
                  browse and book classes directly.
                </p>
              </div>
              <FlowHintPanel
                flowType="widget-embed"
                buttonLabel="How to embed"
              />
            </div>
            <Link
              href="/settings/widget"
              className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Widget Settings →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Referral — owner + manager ── */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Referral
        </h2>
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-xl" aria-hidden>🎁</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Referral Program
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Refer another studio owner and you both get 1 month free.
                  No limits — keep sharing, keep saving.
                </p>
                <Link
                  href="/settings/referral"
                  className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  View Referral Link →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Account ── */}
      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Account
        </h2>
        <div className="space-y-6">
          {/* Billing — owner only */}
          {isOwner && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900">Billing</h3>
              <p className="mt-2 text-sm text-gray-600">
                Manage your subscription and payment methods.
              </p>
              <Link
                href="/settings/billing"
                className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Manage billing →
              </Link>
            </div>
          )}

          {/* Profile */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900">Profile</h3>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-xs text-gray-400">Name</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {fullName}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Email</dt>
                <dd className="text-sm font-medium text-gray-900">{email}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-gray-500">
              Profile editing coming soon.
            </p>
          </div>

          {/* Support — owner only */}
          {isOwner && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900">Support</h3>
              <p className="mt-2 text-sm text-gray-600">
                Open a support ticket or view your existing tickets.
              </p>
              <Link
                href="/settings/support"
                className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Support tickets →
              </Link>
            </div>
          )}

          {/* Tutorial — owner only */}
          {isOwner && <div className="card">
            <h3 className="text-lg font-semibold text-gray-900">Tutorial</h3>
            <p className="mt-2 text-sm text-gray-600">
              Replay the onboarding tour or mark it as complete.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleReplayTutorial}
                disabled={replayLoading}
                className="btn-secondary"
              >
                {replayLoading ? "Starting\u2026" : "Replay Tutorial"}
              </button>
              {!showMarkCompleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowMarkCompleteConfirm(true)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Mark Tutorial as Complete
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-800">
                    This will permanently mark the tutorial as done. Continue?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleMarkComplete}
                      disabled={markCompleteLoading}
                      className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {markCompleteLoading ? "Saving\u2026" : "Yes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMarkCompleteConfirm(false)}
                      disabled={markCompleteLoading}
                      className="rounded border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>}

          {/* Data Export — owner only */}
          {isOwner && <div className="card">
            <h3 className="text-lg font-semibold text-gray-900">
              Export your data
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Download a copy of your studio data (members, classes, bookings,
              etc.) in JSON format.
            </p>
            <button
              type="button"
              onClick={handleExport}
              className="btn-secondary mt-4"
            >
              Export my data
            </button>
          </div>}

          {/* Danger Zone — owner only */}
          {isOwner && <div className="card border-red-200">
            <h3 className="text-lg font-semibold text-red-600">Danger Zone</h3>
            <p className="mt-2 text-sm text-gray-600">
              Permanently delete your account and all associated data.
            </p>

            <button
              type="button"
              onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmInput(""); }}
              className="btn-danger mt-4"
            >
              Delete my account
            </button>

            {/* Account deletion confirmation with studio name input */}
            {showDeleteConfirm && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center">
                <div
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                  onClick={() => setShowDeleteConfirm(false)}
                />
                <div className="relative mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                      <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900">Delete your account</h3>
                      <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                        This will permanently delete your account, studio, and all associated data (members, classes, bookings). This action cannot be undone.
                      </p>
                      <p className="mt-2 text-sm font-medium text-red-600">
                        All data will be permanently removed and cannot be recovered.
                      </p>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700">
                          Type <span className="font-bold text-red-600">{studioName}</span> to confirm
                        </label>
                        <input
                          type="text"
                          value={deleteConfirmInput}
                          onChange={(e) => setDeleteConfirmInput(e.target.value)}
                          placeholder={studioName}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleteLoading}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleteLoading || deleteConfirmInput !== studioName}
                      className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {deleteLoading ? "Deleting..." : "Yes, delete everything"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>}
        </div>
      </section>

      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
