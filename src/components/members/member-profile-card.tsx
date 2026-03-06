"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  formatCredits,
  formatDate,
  formatTime,
  getPlanLabel,
  getStatusColor,
  formatCurrency,
} from "@/lib/utils";

type MemberProfileData = {
  member: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    plan_type: string;
    credits: number;
    status: string;
    waiver_signed: boolean;
    waiver_signed_at: string | null;
    joined_at: string;
    classes_count: number;
    last_class: { date: string; time: string } | null;
    next_billing: { date: string; amount: number } | null;
    months: number;
  };
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

function formatLastClass(date: string, time: string): string {
  const d = new Date(date + "T" + time);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return `Today, ${formatTime(time)}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) {
    return `Yesterday, ${formatTime(time)}`;
  }
  return `${formatDate(date)}, ${formatTime(time)}`;
}

type Props = {
  memberId: string;
  open: boolean;
  onClose: () => void;
};

export default function MemberProfileCard({
  memberId,
  open,
  onClose,
}: Props) {
  const [data, setData] = useState<MemberProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(() => {
    if (!memberId || !open) return;
    setLoading(true);
    fetch(`/api/members/${memberId}/profile`)
      .then((r) => r.json())
      .then((res) => {
        if (res.member) setData(res);
        else setData(null);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [memberId, open]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-profile-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="member-profile-title"
            className="text-center text-lg font-semibold text-gray-900"
          >
            Member Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          </div>
        ) : data ? (
          <>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-100 text-lg font-semibold text-sky-700">
                {getInitials(data.member.full_name)}
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {data.member.full_name}
                </p>
                <p className="text-sm text-gray-500">
                  {getPlanLabel(data.member.plan_type)} ·{" "}
                  <span className="capitalize">{data.member.status}</span>
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-gray-50 px-3 py-3 text-center">
                <p className="text-2xl font-bold text-brand-600">
                  {data.member.classes_count}
                </p>
                <p className="text-xs text-gray-500">Classes</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-3 text-center">
                <p className="text-2xl font-bold text-brand-600">
                  {formatCredits(data.member.credits) === "Unlimited"
                    ? "∞"
                    : data.member.credits}
                </p>
                <p className="text-xs text-gray-500">Credits</p>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-3 text-center">
                <p className="text-2xl font-bold text-brand-600">
                  {data.member.months}
                </p>
                <p className="text-xs text-gray-500">Months</p>
              </div>
            </div>

            <dl className="mt-5 space-y-2 border-t border-gray-100 pt-4">
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">{data.member.email}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Waiver</dt>
                <dd className="font-medium text-gray-900">
                  {data.member.waiver_signed ? (
                    <span className="text-green-600">
                      ✓ {formatDate(data.member.waiver_signed_at ?? "")}
                    </span>
                  ) : (
                    <span className="text-amber-600">Pending</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Next billing</dt>
                <dd className="font-medium text-gray-900">
                  {data.member.next_billing
                    ? `${formatDate(data.member.next_billing.date)} · ${formatCurrency(data.member.next_billing.amount)}`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Last class</dt>
                <dd className="font-medium text-gray-900">
                  {data.member.last_class
                    ? formatLastClass(
                        data.member.last_class.date,
                        data.member.last_class.time
                      )
                    : "—"}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex gap-3">
              <a
                href={`mailto:${data.member.email}`}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-700"
              >
                Send Message
              </a>
              <Link
                href={`/members/${data.member.id}`}
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Edit Plan
              </Link>
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-red-600">
            Failed to load member profile.
          </p>
        )}
      </div>
    </>
  );
}
