"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type InstructorTaxRow = {
  instructor_id: string;
  name: string;
  email: string;
  total_gross: number;
  total_payout: number;
  total_studio_fee: number;
  total_platform_fee: number;
  total_stripe_fee: number;
  transaction_count: number;
  requires_1099: boolean;
};

type TaxReport = {
  year: number;
  summary: {
    total_gross: number;
    total_payout: number;
    total_studio_fee: number;
    instructor_count: number;
    instructors_requiring_1099: number;
  };
  instructors: InstructorTaxRow[];
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function TaxReportPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<TaxReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/instructor-earnings/tax-report?year=${year}`);
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 403 && data.error === "Feature not enabled") {
          setError("Tax Report feature is not enabled for your studio. Contact support to enable it.");
        } else {
          setError(data.error ?? "Failed to load report");
        }
        return;
      }
      const data: TaxReport = await res.json();
      setReport(data);
    } catch {
      setError("Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            Annual instructor payout summary for 1099-NEC compliance
          </p>
        </div>
        <a
          href={`/api/instructor-earnings/tax-report/pdf?year=${year}`}
          download
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download PDF
        </a>
      </div>

      {/* Year selector */}
      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Year:</label>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
          className="input-field w-32"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading && !error && (
        <div className="mt-6 card">
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      )}

      {!loading && !error && report && (
        <>
          {/* Summary Cards */}
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="card">
              <p className="text-xs font-medium text-gray-500 uppercase">Total Gross</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatCents(report.summary.total_gross)}
              </p>
            </div>
            <div className="card">
              <p className="text-xs font-medium text-gray-500 uppercase">Total Payouts</p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                {formatCents(report.summary.total_payout)}
              </p>
            </div>
            <div className="card">
              <p className="text-xs font-medium text-gray-500 uppercase">Studio Revenue</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {formatCents(report.summary.total_studio_fee)}
              </p>
            </div>
            <div className="card">
              <p className="text-xs font-medium text-gray-500 uppercase">
                Requiring 1099
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {report.summary.instructors_requiring_1099}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                of {report.summary.instructor_count} instructors
              </p>
            </div>
          </div>

          {/* Instructor Detail Table */}
          <div className="mt-6 card overflow-x-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Instructor Breakdown
            </h2>
            {report.instructors.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                No instructor earnings for {year}.
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase text-gray-500">
                    <th className="pb-3 pr-4">Instructor</th>
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4 text-right">Classes</th>
                    <th className="pb-3 pr-4 text-right">Total Payout</th>
                    <th className="pb-3 text-center">1099-NEC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.instructors.map((inst) => (
                    <tr key={inst.instructor_id}>
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {inst.name}
                      </td>
                      <td className="py-3 pr-4 text-gray-500">{inst.email}</td>
                      <td className="py-3 pr-4 text-right text-gray-600">
                        {inst.transaction_count}
                      </td>
                      <td className="py-3 pr-4 text-right font-medium text-gray-900">
                        {formatCents(inst.total_payout)}
                      </td>
                      <td className="py-3 text-center">
                        {inst.requires_1099 ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Required
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> The IRS requires a 1099-NEC form for any
              non-employee who was paid $600 or more during the tax year. This
              report helps identify which instructors meet the threshold but does
              not constitute tax advice. Consult with a tax professional.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
