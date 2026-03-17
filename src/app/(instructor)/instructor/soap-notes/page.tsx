"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

type MemberItem = {
  id: string;
  name: string;
  email: string;
};

export default function SOAPNotesPage() {
  const { isEnabled } = useFeature();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isEnabled(FEATURE_KEYS.SOAP_NOTES)) {
      setLoading(false);
      return;
    }

    fetch("/api/instructor/members")
      .then((res) => res.json())
      .then((data) => {
        setMembers(data.members || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isEnabled]);

  if (!isEnabled(FEATURE_KEYS.SOAP_NOTES)) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">SOAP Notes</h1>
        <p className="mt-2 text-sm text-gray-500">This feature is not enabled for your studio.</p>
      </div>
    );
  }

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">SOAP Notes</h1>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        Select a member to view or create session notes
      </p>

      <input
        type="text"
        placeholder="Search members..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input-field mb-4 w-full max-w-md"
      />

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No members found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <Link
              key={m.id}
              href={`/instructor/soap-notes/${m.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50"
            >
              <div>
                <p className="font-medium text-gray-900">{m.name}</p>
                <p className="text-sm text-gray-500">{m.email}</p>
              </div>
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 4.5l7.5 7.5-7.5 7.5"
                />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
