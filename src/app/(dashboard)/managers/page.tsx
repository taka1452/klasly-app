"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type ManagerInfo = {
  id: string;
  profileId: string;
  fullName: string;
  email: string;
  canManageMembers: boolean;
  canManageClasses: boolean;
  canManageInstructors: boolean;
  canManageBookings: boolean;
  canManageRooms: boolean;
  canViewPayments: boolean;
  canSendMessages: boolean;
  createdAt: string;
};

const permissionLabels: { key: keyof Omit<ManagerInfo, "id" | "profileId" | "fullName" | "email" | "createdAt">; label: string }[] = [
  { key: "canManageMembers", label: "Members" },
  { key: "canManageClasses", label: "Classes" },
  { key: "canManageInstructors", label: "Instructors" },
  { key: "canManageBookings", label: "Bookings" },
  { key: "canManageRooms", label: "Rooms" },
  { key: "canViewPayments", label: "Payments (view)" },
  { key: "canSendMessages", label: "Messages" },
];

export default function ManagersPage() {
  const [managers, setManagers] = useState<ManagerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchManagers = useCallback(async () => {
    const res = await fetch("/api/managers");
    if (res.ok) setManagers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setInviteLoading(true);

    const res = await fetch("/api/managers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to invite manager");
      setInviteLoading(false);
      return;
    }

    setSuccess("Manager invited successfully!");
    setInviteEmail("");
    setShowInvite(false);
    setInviteLoading(false);
    await fetchManagers();
  }

  async function handleTogglePermission(manager: ManagerInfo, key: string, value: boolean) {
    const res = await fetch("/api/managers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: manager.id, [key]: value }),
    });
    if (res.ok) await fetchManagers();
  }

  async function handleRemove(manager: ManagerInfo) {
    if (!confirm(`Remove ${manager.fullName || manager.email} as manager?`)) return;
    const res = await fetch(`/api/managers?id=${manager.id}`, { method: "DELETE" });
    if (res.ok) {
      setSuccess("Manager removed");
      await fetchManagers();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Managers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Invite managers to help run your studio with customizable permissions.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="btn-primary"
        >
          + Invite manager
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">{success}</div>
      )}

      {showInvite && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Invite a manager</h2>
          <form onSubmit={handleInvite} className="mt-4 flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="manager@example.com"
              required
              className="input-field flex-1"
            />
            <button type="submit" disabled={inviteLoading} className="btn-primary">
              {inviteLoading ? "Sending..." : "Invite"}
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {managers.length > 0 ? (
        <div className="space-y-4">
          {managers.map((mgr) => (
            <div key={mgr.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {mgr.fullName || "—"}
                  </p>
                  <p className="text-sm text-gray-500">{mgr.email}</p>
                </div>
                <button
                  onClick={() => handleRemove(mgr)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Permissions
                </p>
                <div className="flex flex-wrap gap-2">
                  {permissionLabels.map(({ key, label }) => {
                    const isEnabled = mgr[key] as boolean;
                    return (
                      <button
                        key={key}
                        onClick={() => handleTogglePermission(mgr, key, !isEnabled)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          isEnabled
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        }`}
                      >
                        {isEnabled ? "✓" : "—"} {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card py-12 text-center">
          <p className="text-gray-500">No managers yet.</p>
          <p className="mt-1 text-sm text-gray-400">
            Invite someone to help manage your studio.
          </p>
        </div>
      )}
    </div>
  );
}
