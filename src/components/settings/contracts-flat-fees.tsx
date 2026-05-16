"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type RentalReport = {
  instructorId: string;
  name: string;
  email: string;
  rentalType: "flat_monthly" | "per_class" | "per_hour";
  rentalAmount: number;
  classCount: number;
  hoursBilled: number;
  totalDue: number;
};

const RENTAL_TYPE_LABEL: Record<RentalReport["rentalType"], string> = {
  flat_monthly: "Monthly",
  per_class: "Per class",
  per_hour: "Per hour",
};

const RENTAL_TYPE_BADGE: Record<RentalReport["rentalType"], string> = {
  flat_monthly: "bg-brand-100 text-brand-700",
  per_class: "bg-blue-100 text-blue-700",
  per_hour: "bg-amber-100 text-amber-700",
};

const RENTAL_RATE_SUFFIX: Record<RentalReport["rentalType"], string> = {
  flat_monthly: " / month",
  per_class: " / class",
  per_hour: " / hour",
};

type Totals = {
  totalDue: number;
  instructorCount: number;
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ContractsFlatFees() {
  const [report, setReport] = useState<RentalReport[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );

  const fetchReport = useCallback(async () => {
    const res = await fetch(
      `/api/instructor-earnings/rental-report?month=${selectedMonth}`,
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
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <strong>When to use:</strong> Use flat / per-class fees when the
        instructor pays a simple fixed amount (either monthly or per class
        taught). Settlement is manual &mdash; this page shows what each
        instructor owes so you can collect via bank transfer, cash, etc.
        Configure the amount on each instructor&apos;s edit page.
      </div>

      <div className="mb-4 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Month:</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="input-field w-auto"
        />
      </div>

      {loading ? (
        <div className="card">
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      ) : (
        <>
          {totals && totals.instructorCount > 0 && (
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div className="card">
                <p className="text-sm text-gray-500">Total Rental Due</p>
                <p className="mt-1 text-2xl font-bold text-green-600">
                  {formatCents(totals.totalDue)}
                </p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-500">Instructors</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {totals.instructorCount}
                </p>
              </div>
            </div>
          )}

          <div>
            {report.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {report.map((r) => (
                  <div key={r.instructorId} className="card">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          href={`/instructors/${r.instructorId}`}
                          className="font-semibold text-gray-900 hover:text-brand-600"
                        >
                          {r.name}
                        </Link>
                        <p className="text-sm text-gray-500">{r.email}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${RENTAL_TYPE_BADGE[r.rentalType]}`}
                      >
                        {RENTAL_TYPE_LABEL[r.rentalType]}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Rate</span>
                        <span className="font-medium text-gray-900">
                          {formatCents(r.rentalAmount)}
                          {RENTAL_RATE_SUFFIX[r.rentalType]}
                        </span>
                      </div>
                      {r.rentalType === "per_class" && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Classes taught</span>
                          <span className="font-medium text-gray-900">
                            {r.classCount}
                          </span>
                        </div>
                      )}
                      {r.rentalType === "per_hour" && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Hours billed</span>
                          <span className="font-medium text-gray-900">
                            {r.hoursBilled.toFixed(2)} hr
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-gray-100 pt-2">
                        <span className="font-medium text-gray-700">
                          Amount due
                        </span>
                        <span className="font-bold text-green-600">
                          {formatCents(r.totalDue)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card py-8 text-center">
                <p className="text-sm text-gray-500">
                  No instructors with flat / per-class fees configured.
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  Open an instructor&apos;s edit page to set a fee.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
