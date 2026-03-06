"use client";

import { useState } from "react";
import { formatCredits, formatDate, getPlanLabel, getStatusColor } from "@/lib/utils";
import MemberProfileCard from "./member-profile-card";

type Member = {
  id: string;
  profiles?: { full_name?: string; email?: string } | null;
  plan_type: string;
  credits: number;
  status: string;
  waiver_signed?: boolean;
  waiver_signed_at?: string;
};

type Props = {
  members: Member[];
};

export default function MembersListClient({ members }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      {/* モバイル: カードリスト */}
      <div className="space-y-3 sm:hidden">
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => setSelectedId(member.id)}
            className="card block w-full cursor-pointer text-left transition-colors hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">
                  {member.profiles?.full_name || "—"}
                </p>
                <p className="mt-0.5 truncate text-sm text-gray-500">
                  {member.profiles?.email || "—"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(
                      member.status
                    )}`}
                  >
                    {member.status}
                  </span>
                  {member.waiver_signed ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      ✓ {formatDate(member.waiver_signed_at ?? "")}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      Pending
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-sm font-medium text-brand-600">
                View
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* デスクトップ: テーブル */}
      <div className="card hidden overflow-hidden p-0 sm:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Credits
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Waiver
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {members.map((member) => (
              <tr
                key={member.id}
                onClick={() => setSelectedId(member.id)}
                className="cursor-pointer hover:bg-gray-50"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(member.id);
                  }
                }}
              >
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.profiles?.full_name || "—"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {member.profiles?.email || "—"}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {getPlanLabel(member.plan_type)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {formatCredits(member.credits)}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${getStatusColor(
                      member.status
                    )}`}
                  >
                    {member.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {member.waiver_signed ? (
                    <span className="inline-flex items-center gap-1 text-sm text-green-600">
                      <span>✓</span>
                      {formatDate(member.waiver_signed_at ?? "")}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MemberProfileCard
        memberId={selectedId ?? ""}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
