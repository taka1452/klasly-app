"use client";

import { useState, useEffect, useCallback } from "react";

type ManagerPermissions = {
  id: string;
  canManageMembers: boolean;
  canManageClasses: boolean;
  canManageInstructors: boolean;
  canManageBookings: boolean;
  canManageRooms: boolean;
  canViewPayments: boolean;
  canSendMessages: boolean;
};

const permissionLabels: {
  key: keyof Omit<ManagerPermissions, "id">;
  label: string;
  desc: string;
}[] = [
  { key: "canManageMembers", label: "Members", desc: "View and manage studio members" },
  { key: "canManageClasses", label: "Classes", desc: "Create and edit classes" },
  { key: "canManageInstructors", label: "Instructors", desc: "Manage other instructors" },
  { key: "canManageBookings", label: "Bookings", desc: "Manage class bookings" },
  { key: "canManageRooms", label: "Rooms", desc: "Manage studio rooms" },
  { key: "canViewPayments", label: "Payments", desc: "View payment info" },
  { key: "canSendMessages", label: "Messages", desc: "Send messages to members" },
];

export default function InstructorManagerToggle({
  instructorId,
}: {
  instructorId: string;
}) {
  const [isManager, setIsManager] = useState(false);
  const [permissions, setPermissions] = useState<ManagerPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/instructors/${instructorId}/manager-role`);
    if (res.ok) {
      const data = await res.json();
      setIsManager(data.isManager);
      setPermissions(data.manager);
    }
    setLoading(false);
  }, [instructorId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleToggle() {
    setError("");
    setToggling(true);

    if (isManager) {
      const res = await fetch(`/api/instructors/${instructorId}/manager-role`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to revoke manager role");
      } else {
        const data = await res.json();
        setIsManager(data.isManager);
        setPermissions(data.manager);
      }
    } else {
      const res = await fetch(`/api/instructors/${instructorId}/manager-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to grant manager role");
      } else {
        const data = await res.json();
        setIsManager(data.isManager);
        setPermissions(data.manager);
      }
    }

    setToggling(false);
  }

  async function handleTogglePermission(key: string, value: boolean) {
    const res = await fetch(`/api/instructors/${instructorId}/manager-role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (res.ok) {
      const data = await res.json();
      setPermissions(data.manager);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500" />
          <span className="text-sm text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-500">Manager Role</h3>
          <p className="mt-1 text-xs text-gray-400">
            Grant dashboard access with customizable permissions.
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
            isManager ? "bg-brand-500" : "bg-gray-200"
          } ${toggling ? "opacity-50" : ""}`}
          role="switch"
          aria-checked={isManager}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isManager ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {isManager && permissions && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">
            Permissions
          </p>
          <div className="flex flex-wrap gap-2">
            {permissionLabels.map(({ key, label }) => {
              const isEnabled = permissions[key] as boolean;
              return (
                <button
                  key={key}
                  onClick={() => handleTogglePermission(key, !isEnabled)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    isEnabled
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  {isEnabled ? "\u2713" : "\u2014"} {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
