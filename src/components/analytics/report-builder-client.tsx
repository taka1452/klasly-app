"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DateRangePreset,
  GroupBy,
  ReportFilters,
  ReportResult,
  ReportType,
} from "@/lib/reports/types";
import { REPORT_TYPE_META } from "@/lib/reports/types";

type SavedReport = {
  id: string;
  name: string;
  description: string | null;
  report_type: ReportType;
  filters: ReportFilters;
  is_favorite: boolean;
  updated_at: string;
};

type Props = {
  instructors: { id: string; name: string }[];
};

const DATE_RANGE_OPTIONS: Array<{ value: DateRangePreset; label: string }> = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "ytd", label: "Year to date" },
  { value: "custom", label: "Custom range" },
];

const GROUP_BY_OPTIONS: Array<{ value: GroupBy; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function defaultFiltersFor(type: ReportType): ReportFilters {
  return {
    date_range: "last_30_days",
    group_by: REPORT_TYPE_META[type].defaultGroupBy,
  };
}

function isCurrencyYAxis(result: ReportResult): boolean {
  return (
    result.report_type === "revenue_over_time" ||
    result.report_type === "instructor_payouts"
  );
}

function formatYAxisTick(value: number, currency: boolean): string {
  if (!currency) return String(value);
  if (Math.abs(value) >= 100_000) return `$${Math.round(value / 100) / 10}k`;
  return `$${(value / 100).toFixed(0)}`;
}

function formatTooltip(value: number, name: string, currency: boolean): [string, string] {
  if (!currency) return [String(value), name];
  return [`$${(value / 100).toFixed(2)}`, name];
}

export default function ReportBuilderClient({ instructors }: Props) {
  const [reportType, setReportType] = useState<ReportType>("revenue_over_time");
  const [filters, setFilters] = useState<ReportFilters>(
    defaultFiltersFor("revenue_over_time")
  );
  const [result, setResult] = useState<ReportResult | null>(null);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [runLoading, setRunLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saveName, setSaveName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);

  const fetchSaved = useCallback(async () => {
    const res = await fetch("/api/reports");
    if (res.ok) {
      setSaved(await res.json());
    }
  }, []);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const run = useCallback(
    async (type: ReportType, f: ReportFilters) => {
      setRunLoading(true);
      setError(null);
      const res = await fetch("/api/reports?action=run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_type: type, filters: f }),
      });
      setRunLoading(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to run report");
        setResult(null);
        return;
      }
      setResult(await res.json());
    },
    []
  );

  useEffect(() => {
    run(reportType, filters);
  }, [reportType, filters, run]);

  async function loadSaved(s: SavedReport) {
    setReportType(s.report_type);
    setFilters(s.filters || defaultFiltersFor(s.report_type));
  }

  async function handleSave() {
    if (!saveName.trim()) return;
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: saveName.trim(),
        report_type: reportType,
        filters,
      }),
    });
    if (res.ok) {
      setSaveOpen(false);
      setSaveName("");
      await fetchSaved();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
    }
  }

  async function toggleFavorite(s: SavedReport) {
    const res = await fetch(`/api/reports/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: !s.is_favorite }),
    });
    if (res.ok) await fetchSaved();
  }

  async function deleteSaved(s: SavedReport) {
    if (!confirm(`Delete saved report "${s.name}"?`)) return;
    const res = await fetch(`/api/reports/${s.id}`, { method: "DELETE" });
    if (res.ok) await fetchSaved();
  }

  function exportCsv() {
    if (!result) return;
    const header = ["label", ...result.chart.series];
    const rows = result.chart.points.map((p) =>
      [p.label, p.value, ...(p.value2 !== undefined ? [p.value2] : [])].join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Saved reports sidebar */}
      <aside className="card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Saved reports
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Click to load. ★ = favorite.
        </p>
        <ul className="mt-3 space-y-1">
          {saved.length === 0 && (
            <li className="text-xs italic text-gray-400">
              None yet — build a report and click &quot;Save&quot;.
            </li>
          )}
          {saved.map((s) => (
            <li
              key={s.id}
              className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50"
            >
              <button
                type="button"
                onClick={() => loadSaved(s)}
                className="flex-1 truncate text-left text-sm text-gray-900"
                title={s.description || s.name}
              >
                <span className="mr-1">{s.is_favorite ? "★" : "·"}</span>
                {s.name}
                <span className="ml-1 text-xs text-gray-400">
                  {REPORT_TYPE_META[s.report_type].label}
                </span>
              </button>
              <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => toggleFavorite(s)}
                  className="px-1.5 text-xs text-gray-400 hover:text-amber-500"
                  aria-label={s.is_favorite ? "Unfavorite" : "Favorite"}
                >
                  ★
                </button>
                <button
                  type="button"
                  onClick={() => deleteSaved(s)}
                  className="px-1.5 text-xs text-gray-400 hover:text-red-500"
                  aria-label="Delete"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* Builder */}
      <section className="space-y-4">
        <div className="card">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Report
              </label>
              <select
                value={reportType}
                onChange={(e) => {
                  const t = e.target.value as ReportType;
                  setReportType(t);
                  setFilters(defaultFiltersFor(t));
                }}
                className="input-field"
              >
                {(Object.keys(REPORT_TYPE_META) as ReportType[]).map((t) => (
                  <option key={t} value={t}>
                    {REPORT_TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Date range
              </label>
              <select
                value={filters.date_range || "last_30_days"}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    date_range: e.target.value as DateRangePreset,
                  })
                }
                className="input-field"
              >
                {DATE_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {filters.date_range === "custom" && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                    From
                  </label>
                  <input
                    type="date"
                    value={filters.date_from || ""}
                    onChange={(e) =>
                      setFilters({ ...filters, date_from: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                    To
                  </label>
                  <input
                    type="date"
                    value={filters.date_to || ""}
                    onChange={(e) =>
                      setFilters({ ...filters, date_to: e.target.value })
                    }
                    className="input-field"
                  />
                </div>
              </>
            )}

            {reportType !== "room_utilization" &&
              reportType !== "instructor_payouts" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Group by
                  </label>
                  <select
                    value={filters.group_by || REPORT_TYPE_META[reportType].defaultGroupBy}
                    onChange={(e) =>
                      setFilters({ ...filters, group_by: e.target.value as GroupBy })
                    }
                    className="input-field"
                  >
                    {GROUP_BY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            {(reportType === "class_attendance" ||
              reportType === "instructor_payouts") && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Instructor
                </label>
                <select
                  value={filters.instructor_id || ""}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      instructor_id: e.target.value || undefined,
                    })
                  }
                  className="input-field"
                >
                  <option value="">All instructors</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={exportCsv}
                disabled={!result}
                className="btn-secondary"
              >
                ↓ CSV
              </button>
              <button
                type="button"
                onClick={() => setSaveOpen(true)}
                disabled={!result}
                className="btn-primary"
              >
                Save report
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            {REPORT_TYPE_META[reportType].description}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Summary tiles */}
        {result && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {result.summary.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {s.label}
                </div>
                <div className="mt-1 text-xl font-bold text-gray-900">
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        <div className="card min-h-[320px]">
          {runLoading ? (
            <p className="py-10 text-center text-sm text-gray-500">
              Running report...
            </p>
          ) : !result ? (
            <p className="py-10 text-center text-sm text-gray-500">No data yet.</p>
          ) : result.chart.points.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              No data for the selected range.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              {result.chart.kind === "line" ? (
                <LineChart data={result.chart.points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis
                    fontSize={11}
                    tickFormatter={(v: number) => formatYAxisTick(v, isCurrencyYAxis(result))}
                  />
                  <Tooltip
                    formatter={(value, name) =>
                      formatTooltip(value as number, String(name), isCurrencyYAxis(result))
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={result.chart.series[0]}
                    stroke="#0074c5"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  {result.chart.series[1] && (
                    <Line
                      type="monotone"
                      dataKey="value2"
                      name={result.chart.series[1]}
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  )}
                </LineChart>
              ) : (
                <BarChart data={result.chart.points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis
                    fontSize={11}
                    tickFormatter={(v: number) => formatYAxisTick(v, isCurrencyYAxis(result))}
                  />
                  <Tooltip
                    formatter={(value, name) =>
                      formatTooltip(value as number, String(name), isCurrencyYAxis(result))
                    }
                  />
                  <Legend />
                  <Bar dataKey="value" name={result.chart.series[0]} fill="#0074c5">
                    {result.chart.points.map((_, idx) => (
                      <Cell key={idx} />
                    ))}
                  </Bar>
                  {result.chart.series[1] && (
                    <Bar
                      dataKey="value2"
                      name={result.chart.series[1]}
                      fill="#10b981"
                    />
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Save modal */}
      {saveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSaveOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900">Save report</h3>
            <p className="mt-1 text-xs text-gray-500">
              Saves the current report type + filters with a name you can click
              from the sidebar later.
            </p>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Monthly revenue summary"
              className="input-field mt-3 w-full"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
