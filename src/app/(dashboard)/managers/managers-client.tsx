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
  canManageSettings: boolean;
  canTeach: boolean;
  createdAt: string;
};

type PermissionKey = keyof Omit<
  ManagerInfo,
  "id" | "profileId" | "fullName" | "email" | "createdAt"
>;

type PermissionDef = {
  key: PermissionKey;
  label: string;
  /** One-line gist shown in hover tooltip and on the compact badge. */
  short: string;
  /** Full description surfaced in the "What each permission allows" panel. */
  long: string;
  /** Specific pages/actions this permission gates. */
  allows: string[];
  /** Things it does NOT cover, to clear up ambiguity. */
  doesNotInclude?: string[];
};

const PERMISSIONS: PermissionDef[] = [
  {
    key: "canManageMembers",
    label: "Members",
    short: "Create, edit, and view member profiles and credits",
    long: "Full access to the member roster: invite, edit profiles, adjust credits, manage passes, view waiver status.",
    allows: [
      "Members page: view, search, invite, edit, archive",
      "Adjust credits / passes manually",
      "View waiver signing status and resend invites",
    ],
    doesNotInclude: [
      "Seeing payment amounts or Stripe details (needs Payments)",
      "Deleting the account or taking refund actions (owner only)",
    ],
  },
  {
    key: "canManageClasses",
    label: "Classes",
    short: "Create and edit class templates, sessions, and schedules",
    long: "Build the studio schedule: class templates, sessions, recurring series, room assignment, cancellations.",
    allows: [
      "Create/edit/deactivate class templates",
      "Schedule single or weekly-recurring sessions",
      "Edit or cancel individual sessions",
    ],
    doesNotInclude: [
      "Managing bookings or attendance on a session (needs Bookings)",
    ],
  },
  {
    key: "canManageInstructors",
    label: "Instructors",
    short: "Invite, edit, and remove instructors",
    long: "Everything under the Instructors tab: invite new instructors, edit profiles, assign contracts, remove.",
    allows: [
      "Instructors page: invite, edit, deactivate",
      "Assign hourly plan or flat/per-class fee on instructor edit",
      "View rental / overage reports",
    ],
  },
  {
    key: "canManageBookings",
    label: "Bookings",
    short: "View bookings, manage attendance, and cancel bookings",
    long: "Day-to-day booking operations: attendance, walk-ins, cancellations on behalf of members.",
    allows: [
      "Bookings page: view, filter, cancel",
      "Take attendance on any session",
      "Add drop-in attendees",
    ],
  },
  {
    key: "canManageRooms",
    label: "Rooms",
    short: "Create, edit, and manage studio rooms",
    long: "Room inventory + instructor room-booking management.",
    allows: [
      "Rooms page: create, edit, deactivate rooms",
      "View instructor room bookings on the calendar",
      "Cancel any instructor room booking with optional reason",
    ],
  },
  {
    key: "canViewPayments",
    label: "Payments",
    short: "View payment history, passes, and export reports",
    long: "Read-only access to financial data. Cannot trigger refunds or Stripe changes.",
    allows: [
      "View individual member payment history",
      "View pass revenue and export CSV reports",
      "View studio billing info",
    ],
    doesNotInclude: [
      "Issuing refunds, editing prices, or changing Stripe Connect (owner only)",
    ],
  },
  {
    key: "canSendMessages",
    label: "Messages",
    short: "Send messages and announcements to members",
    long: "Outbound communication tools: direct messages, campaigns, in-app announcements.",
    allows: [
      "Direct-message any member",
      "Create and send email campaigns",
      "Post studio-wide announcements",
    ],
  },
  {
    key: "canManageSettings",
    label: "Settings",
    short: "Access studio settings, contracts, and widget configuration",
    long: "Configure how the studio runs. Includes Contracts (hourly plans / overage / flat fees), Collective Setup, booking rules, widget, waiver template, features, notifications — and the Test Accounts switcher.",
    allows: [
      "Settings page (most cards)",
      "Contracts: hourly plans, overage policy, flat fees",
      "Collective Mode setup + Studio Fee",
      "Widget config, waiver template, features, notifications",
      "Test Accounts switcher (impersonate test instructor/member)",
    ],
    doesNotInclude: [
      "Stripe Connect, subscription/billing, and account deletion (owner only)",
    ],
  },
  {
    key: "canTeach",
    label: "Teach",
    short: "Register as instructor and teach classes",
    long: "Lets this manager also act as an instructor for the studio. Adds 'My Classes' and the instructor portal to their navigation.",
    allows: [
      "Be listed as an instructor record",
      "Create and teach their own classes",
      "Access the instructor-side views",
    ],
    doesNotInclude: [
      "Managing other instructors (needs Instructors permission)",
    ],
  },
];

export default function ManagersClient() {
  const [managers, setManagers] = useState<ManagerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

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
    const res = await fetch(`/api/managers?id=${manager.id}`, { method: "DELETE" });
    if (res.ok) {
      setSuccess("Manager removed");
      setRemoveConfirmId(null);
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
            Invite managers to help run your studio with customizable permissions.{" "}
            <button
              type="button"
              onClick={() => setGuideOpen((o) => !o)}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              {guideOpen ? "Hide" : "What does each permission do?"}
            </button>
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="btn-primary"
        >
          + Invite manager
        </button>
      </div>

      {guideOpen && (
        <div className="card mb-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                What each permission allows
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Managers only see the parts of the studio you grant access to.
                Toggle a permission below any manager&apos;s card to enable
                that area for them.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Close
            </button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {PERMISSIONS.map((p) => (
              <li
                key={p.key}
                className="rounded-lg border border-gray-200 p-3 text-sm"
              >
                <p className="font-medium text-gray-900">{p.label}</p>
                <p className="mt-1 text-xs text-gray-600">{p.long}</p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Allows
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-600">
                  {p.allows.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
                {p.doesNotInclude && p.doesNotInclude.length > 0 && (
                  <>
                    <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                      Does not include
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-500">
                      {p.doesNotInclude.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">{success}</div>
      )}

      {showInvite && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Invite a manager</h2>
          <p className="mt-1 text-xs text-gray-500">
            New managers start with a safe default set of permissions. You can
            fine-tune what they can access right after they&apos;re added.
          </p>
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
                {removeConfirmId === mgr.id ? (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs text-red-700">Remove this manager?</p>
                    <button
                      onClick={() => handleRemove(mgr)}
                      className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setRemoveConfirmId(null)}
                      className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setRemoveConfirmId(mgr.id)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    Permissions
                  </p>
                  <p className="text-xs text-gray-400">
                    Click a permission to toggle it
                  </p>
                </div>
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {PERMISSIONS.map((p) => {
                    const isEnabled = mgr[p.key] as boolean;
                    return (
                      <li
                        key={p.key}
                        className="flex items-start gap-3 px-3 py-2.5"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleTogglePermission(mgr, p.key, !isEnabled)
                          }
                          aria-pressed={isEnabled}
                          className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            isEnabled
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                              : "bg-gray-100 text-gray-400 ring-1 ring-gray-200 hover:bg-gray-200"
                          }`}
                        >
                          <span aria-hidden>{isEnabled ? "✓" : "—"}</span>
                          {p.label}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium ${
                              isEnabled ? "text-gray-900" : "text-gray-500"
                            }`}
                          >
                            {p.label}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {p.short}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
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
