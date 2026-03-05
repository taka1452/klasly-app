"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTourActions } from "@/components/tour/TourProvider";
import Toast from "@/components/ui/toast";
import FlowHintPanel from "@/components/ui/flow-hint-panel";

type Props = {
  fullName: string;
  email: string;
};

export default function SettingsContent({ fullName, email }: Props) {
  const router = useRouter();
  const tourActions = useTourActions();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showMarkCompleteConfirm, setShowMarkCompleteConfirm] = useState(false);
  const [markCompleteLoading, setMarkCompleteLoading] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
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
        alert(data.error ?? "Failed to replay tutorial");
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
        alert(data.error ?? "Failed to mark complete");
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
    setDeleteLoading(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to delete account");
      setDeleteLoading(false);
      return;
    }

    window.location.href = "/login";
  }

  return (
    <div className="mt-8 space-y-8">
      {/* Stripe Connect */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Stripe Connect</h2>
            <p className="mt-2 text-sm text-gray-600">
              Connect your Stripe account to receive payments from members (drop-in, packs, monthly).
            </p>
          </div>
          <FlowHintPanel flowType="stripe-connect" buttonLabel="Why Stripe Connect?" />
        </div>
        <Link
          href="/settings/connect"
          className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Stripe Connect →
        </Link>
      </div>

      {/* Billing */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Billing</h2>
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

      {/* Waiver */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Waiver</h2>
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

      {/* Class Pricing */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Class Pricing</h2>
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

      {/* Support */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Support</h2>
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
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-xs text-gray-400">Name</dt>
            <dd className="text-sm font-medium text-gray-900">{fullName}</dd>
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

      {/* Tutorial */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Tutorial</h2>
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
            {replayLoading ? "Starting…" : "Replay Tutorial"}
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
                  {markCompleteLoading ? "Saving…" : "Yes"}
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
      </div>

      {/* Data Export */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Export your data</h2>
        <p className="mt-2 text-sm text-gray-600">
          Download a copy of your studio data (members, classes, bookings, etc.)
          in JSON format.
        </p>
        <button
          type="button"
          onClick={handleExport}
          className="btn-secondary mt-4"
        >
          Export my data
        </button>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-200">
        <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
        <p className="mt-2 text-sm text-gray-600">
          Permanently delete your account and all associated data.
        </p>

        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-danger mt-4"
          >
            Delete my account
          </button>
        ) : (
          <div className="mt-4 space-y-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              This will permanently delete your account, studio, and all
              associated data (members, classes, bookings). This action cannot
              be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="btn-danger"
              >
                {deleteLoading ? "Deleting..." : "Yes, delete my account"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
