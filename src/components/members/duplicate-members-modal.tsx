"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DuplicateMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
};

type DuplicateGroup = {
  matchType: "email" | "phone" | "name";
  matchValue: string;
  members: DuplicateMember[];
};

type Props = {
  onClose: () => void;
};

const MATCH_LABELS: Record<string, { label: string; color: string }> = {
  email: { label: "Email", color: "bg-red-100 text-red-700" },
  phone: { label: "Phone", color: "bg-amber-100 text-amber-700" },
  name: { label: "Name", color: "bg-blue-100 text-blue-700" },
};

export default function DuplicateMembersModal({ onClose }: Props) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/members/duplicates");
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setGroups(data.groups ?? []);
      } catch {
        setError("Failed to check for duplicates.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 modal-backdrop-enter pt-[10vh]" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-2xl modal-dialog-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Duplicate Members</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              <span className="ml-3 text-sm text-gray-500">Checking for duplicates...</span>
            </div>
          )}

          {error && (
            <p className="py-8 text-center text-sm text-red-600">{error}</p>
          )}

          {!loading && !error && groups.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-green-700">No duplicates found</p>
              <p className="mt-1 text-xs text-gray-500">All member profiles look unique.</p>
            </div>
          )}

          {!loading && groups.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Found {groups.length} potential duplicate group{groups.length !== 1 ? "s" : ""}. Review each group and merge or remove as needed.
              </p>
              {groups.map((group, gi) => {
                const match = MATCH_LABELS[group.matchType] ?? { label: group.matchType, color: "bg-gray-100 text-gray-700" };
                return (
                  <div key={gi} className="rounded-lg border border-gray-200 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${match.color}`}>
                        {match.label} match
                      </span>
                      <span className="text-sm text-gray-600">{group.matchValue}</span>
                    </div>
                    <div className="space-y-2">
                      {group.members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900">{m.name}</p>
                            <p className="truncate text-xs text-gray-500">
                              {m.email}
                              {m.phone && ` · ${m.phone}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              m.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                            }`}>
                              {m.status}
                            </span>
                            <Link
                              href={`/members/${m.id}`}
                              className="text-xs font-medium text-brand-600 hover:text-brand-700"
                              onClick={onClose}
                            >
                              View
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-200 px-6 py-3">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
