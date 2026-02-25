"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  fullName: string;
  email: string;
};

export default function SettingsContent({ fullName, email }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

      {/* Profile */}
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
    </div>
  );
}
