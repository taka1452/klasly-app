"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type InstructorReport = {
  instructorId: string;
  name: string;
  email: string;
  classCount: number;
  totalGross: number;
  totalStudioFee: number;
  totalPlatformFee: number;
  totalInstructorPayout: number;
};

type Totals = {
  totalGross: number;
  totalStudioFee: number;
  totalPlatformFee: number;
  totalInstructorPayout: number;
  totalClasses: number;
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function InstructorEarningsReportPage() {
  const [report, setReport] = useState<InstructorReport[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );

  const fetchReport = useCallback(async () => {
    const res = await fetch(
      `/api/instructor-earnings/studio-report?month=${selectedMonth}`
    );
    if (!res.ok) return;
    const data = await res.json();
    setReport(data.report ?? []);
    setTotals(data.totals ?? null);
  }, [selectedMonth]);

  useEffect(() => {
    setLoading(true);
    fetchReport().finally(() => setLoading(false));
  }, [fetchReport]);

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/instructors"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          &larr; Instructors
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">
        Instructor Earnings Report
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Monthly revenue breakdown by instructor
      </p>

      {/* Month Selector */}
      <div className="mt-6 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Month:</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="input-field w-auto"
        />
      </div>

      {loading ? (
        <div className="mt-6 card">
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      ) : (
        <>
          {/* Totals */}
          {totals && totals.totalClasses > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="card">
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {formatCents(totals.totalGross)}
                </p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500">Studio Revenue</p>
                <p className="mt-1 text-2xl font-bold text-green-600">
                  {formatCents(totals.totalStudioFee)}
                </p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500">
                  Instructor Payouts
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {formatCents(totals.totalInstructorPayout)}
                </p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500">Total Classes</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {totals.totalClasses}
                </p>
              </div>
            </div>
          )}

          {/* Per-Instructor Report */}
          <div className="mt-6">
            {report.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {report.map((r) => (
                  <div key={r.instructorId} className="card">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{r.name}</p>
                        <p className="text-sm text-gray-500">{r.email}</p>
                      </div>
                      <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
                        {r.classCount} classes
                      </span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Revenue</span>
                        <span className="font-medium text-gray-900">
                          {formatCents(r.totalGross)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Studio Fee</span>
                        <span className="font-medium text-green-600">
                          {formatCents(r.totalStudioFee)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          Instructor Payout
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCents(r.totalInstructorPayout)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card py-8 text-center">
                <p className="text-sm text-gray-500">
                  No instructor earnings this month.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
