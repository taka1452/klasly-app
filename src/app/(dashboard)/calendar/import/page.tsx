"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePlanAccess } from "@/components/ui/plan-access-provider";

const SKIP = "— Skip —";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAY_ALIASES: Record<string, number> = {
  "0": 0, sun: 0, sunday: 0,
  "1": 1, mon: 1, monday: 1,
  "2": 2, tue: 2, tues: 2, tuesday: 2,
  "3": 3, wed: 3, wednesday: 3,
  "4": 4, thu: 4, thur: 4, thurs: 4, thursday: 4,
  "5": 5, fri: 5, friday: 5,
  "6": 6, sat: 6, saturday: 6,
};

function normalizeDayOfWeek(value: string): number | null {
  const key = value.trim().toLowerCase();
  const n = DAY_ALIASES[key];
  return n !== undefined ? n : null;
}

function normalizeStartTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type PreviewData = {
  columns: string[];
  preview: Record<string, string>[];
  totalRows: number;
};

type ImportResult = {
  success: boolean;
  summary: { total: number; imported: number; skipped: number; errors: number };
  skipped: { row: number; name: string; reason: string }[];
  errors: { row: number; name: string; reason: string }[];
};

function autoMapColumns(columns: string[]): Record<string, string> {
  const find = (re: RegExp) => columns.find((c) => re.test(c)) ?? "";
  return {
    name: find(/class.*name|^name$|title/i),
    day_of_week: find(/day.*week|day\s*of\s*week|^day$/i),
    start_time: find(/start.*time|time/i),
    duration_minutes: find(/duration|length|minute/i),
    capacity: find(/capacity|max|spots|limit/i),
    description: find(/description|desc/i),
    location: find(/location|room|studio/i),
    instructor_email: find(/instructor|teacher/i),
  };
}

export default function ImportClassesPage() {
  const planAccess = usePlanAccess();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvBase64, setCsvBase64] = useState<string>("");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  // Column mapping state
  const [mapping, setMapping] = useState<Record<string, string>>({
    name: "",
    day_of_week: "",
    start_time: "",
    duration_minutes: "",
    capacity: "",
    description: "",
    location: "",
    instructor_email: "",
  });

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const columns = useMemo(() => previewData?.columns ?? [], [previewData?.columns]);
  const totalRows = previewData?.totalRows ?? 0;

  const setField = (field: string, value: string) =>
    setMapping((prev) => ({ ...prev, [field]: value }));

  const getCell = useCallback(
    (row: Record<string, string>, col: string) =>
      col && col !== SKIP && columns.includes(col) ? (row[col] ?? "").trim() : "",
    [columns]
  );

  const getMappedRow = useCallback(
    (row: Record<string, string>) => {
      const name = getCell(row, mapping.name);
      const dayRaw = getCell(row, mapping.day_of_week);
      const dayNum = normalizeDayOfWeek(dayRaw);
      const timeRaw = getCell(row, mapping.start_time);
      const time = normalizeStartTime(timeRaw);
      const duration = getCell(row, mapping.duration_minutes);
      const capacity = getCell(row, mapping.capacity);
      const location = getCell(row, mapping.location);
      const instructor = getCell(row, mapping.instructor_email);
      return {
        name: name || "—",
        day: dayNum !== null ? DAY_NAMES[dayNum] : dayRaw ? `⚠ ${dayRaw}` : "—",
        dayValid: !dayRaw || dayNum !== null,
        time: time ?? (timeRaw ? `⚠ ${timeRaw}` : "—"),
        timeValid: !timeRaw || time !== null,
        duration: duration || "—",
        capacity: capacity || "—",
        location: location || "—",
        instructor: instructor || "—",
      };
    },
    [mapping, getCell]
  );

  async function handleFile(f: File) {
    setUploadError("");
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Please upload a CSV file.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setUploadError("File size must be 5MB or less.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/import/preview", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setUploadError(data.error ?? "Failed to read file.");
        return;
      }
      const data = (await res.json()) as PreviewData;
      setPreviewData(data);
      setFile(f);

      const reader = new FileReader();
      reader.onload = () => {
        const str = (reader.result as string) ?? "";
        setCsvBase64(btoa(unescape(encodeURIComponent(str))));
      };
      reader.readAsText(f, "UTF-8");

      const auto = autoMapColumns(data.columns);
      setMapping(auto);

      setStep(2);
    } finally {
      setUploading(false);
    }
  }

  async function runImport() {
    if (!csvBase64 || !previewData) return;
    setImporting(true);
    setResult(null);
    setUploadError("");
    try {
      const res = await fetch("/api/import/classes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData: csvBase64, mapping }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Import failed.");
        return;
      }
      setResult(data as ImportResult);
      setStep(3);
    } finally {
      setImporting(false);
    }
  }

  const dropdownOptions = [SKIP, ...columns];
  const requiredFields = ["name", "day_of_week", "start_time", "duration_minutes", "capacity"];
  const allRequiredMapped = requiredFields.every(
    (f) => mapping[f] && mapping[f] !== SKIP && columns.includes(mapping[f])
  );

  const FIELD_CONFIG = [
    { key: "name", label: "Class Name", required: true },
    { key: "day_of_week", label: "Day of Week", required: true, hint: "e.g. Monday, Mon, 1" },
    { key: "start_time", label: "Start Time", required: true, hint: "e.g. 09:00" },
    { key: "duration_minutes", label: "Duration (minutes)", required: true },
    { key: "capacity", label: "Capacity", required: true },
    { key: "description", label: "Description", required: false },
    { key: "location", label: "Location", required: false },
    { key: "instructor_email", label: "Instructor Email", required: false },
  ];

  if (planAccess && !planAccess.canCreate) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link href="/calendar" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to schedule
          </Link>
        </div>
        <div className="card">
          <p className="text-gray-600">
            Your plan doesn&apos;t allow importing classes. Please update your billing to continue.
          </p>
          <Link
            href="/settings/billing"
            className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Update billing →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/calendar" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to schedule
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {step === 1 && "Import Classes from CSV"}
          {step === 2 && "Map Your Columns"}
          {step === 3 && "Import Complete!"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {step === 1 && "Bulk-create your weekly schedule from a spreadsheet."}
          {step === 2 && "Tell us which columns in your CSV match Klasly's fields."}
          {step === 3 && "Summary of your import."}
        </p>
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div className="card">
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 py-12 transition hover:border-brand-500 hover:bg-brand-50/30"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer?.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <p className="text-sm font-medium text-gray-600">
              Drag and drop your CSV here, or click to browse
            </p>
            <p className="mt-1 text-xs text-gray-400">.csv up to 5MB</p>
            <input
              type="file"
              accept=".csv"
              className="sr-only"
              id="csv-upload"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <label htmlFor="csv-upload" className="btn-primary mt-4 cursor-pointer">
              {uploading ? "Reading…" : "Choose file"}
            </label>
          </div>
          {uploadError && <p className="mt-3 text-sm text-red-600">{uploadError}</p>}

          <div className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            <p className="font-medium text-gray-700">Required columns:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-gray-500">
              <li><strong>Name</strong> — class name</li>
              <li><strong>Day of Week</strong> — Monday, Tue, 1-6, etc.</li>
              <li><strong>Start Time</strong> — HH:MM format (e.g. 09:00)</li>
              <li><strong>Duration (minutes)</strong> — e.g. 60</li>
              <li><strong>Capacity</strong> — max attendees</li>
            </ul>
            <p className="mt-2 font-medium text-gray-700">Optional:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-gray-500">
              <li><strong>Description</strong>, <strong>Location</strong></li>
              <li><strong>Instructor Email</strong> — must match an existing instructor</li>
            </ul>
          </div>

          <p className="mt-4 text-center text-sm text-gray-500">
            <a
              href="/api/import/classes/template"
              download="klasly-class-import-template.csv"
              className="text-brand-600 hover:text-brand-700"
            >
              Download Template
            </a>
          </p>
        </div>
      )}

      {/* ── Step 2: Map columns ── */}
      {step === 2 && previewData && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELD_CONFIG.map(({ key, label, required, hint }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700">
                    {label} {required && "★"}
                  </label>
                  {hint && <p className="text-xs text-gray-400">{hint}</p>}
                  <select
                    className="input-field mt-1 w-full"
                    value={mapping[key] ?? ""}
                    onChange={(e) => setField(key, e.target.value === SKIP ? "" : e.target.value)}
                  >
                    {dropdownOptions.map((c) => (
                      <option key={c} value={c === SKIP ? "" : c}>{c}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview table */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Preview (first 5 rows)</p>
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Day</th>
                      <th className="px-3 py-2 text-left font-medium">Time</th>
                      <th className="px-3 py-2 text-left font-medium">Min</th>
                      <th className="px-3 py-2 text-left font-medium">Cap</th>
                      <th className="px-3 py-2 text-left font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview.slice(0, 5).map((row, i) => {
                      const r = getMappedRow(row);
                      return (
                        <tr key={i} className="border-b">
                          <td className="px-3 py-2">{r.name}</td>
                          <td className={`px-3 py-2 ${!r.dayValid ? "text-red-500" : ""}`}>{r.day}</td>
                          <td className={`px-3 py-2 ${!r.timeValid ? "text-red-500" : ""}`}>{r.time}</td>
                          <td className="px-3 py-2">{r.duration}</td>
                          <td className="px-3 py-2">{r.capacity}</td>
                          <td className="px-3 py-2">{r.location}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                ⚠ = value could not be parsed. Fix the CSV or adjust the column mapping.
              </p>
            </div>

            {/* Info */}
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Each imported class will automatically generate <strong>4 weeks of sessions</strong> starting
              from the next occurrence of that day.
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="font-medium text-gray-900">{totalRows} classes will be imported</p>
              <p className="mt-0.5 text-sm text-gray-500">File: {file?.name}</p>
            </div>

            {!allRequiredMapped && (
              <p className="text-sm text-amber-600">
                ★ Please map all required fields before importing.
              </p>
            )}
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={runImport}
                disabled={importing || !allRequiredMapped}
              >
                {importing ? "Importing…" : "Import Classes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Result ── */}
      {step === 3 && result && (
        <div className="card space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{result.summary.imported}</p>
              <p className="text-sm text-green-600">imported</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{result.summary.skipped}</p>
              <p className="text-sm text-amber-600">skipped</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{result.summary.errors}</p>
              <p className="text-sm text-red-600">errors</p>
            </div>
          </div>

          {(result.skipped.length > 0 || result.errors.length > 0) && (
            <div className="overflow-x-auto rounded border border-gray-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium">Row</th>
                    <th className="px-3 py-2 text-left font-medium">Class Name</th>
                    <th className="px-3 py-2 text-left font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {[...result.skipped, ...result.errors].map((item, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2">{item.row}</td>
                      <td className="px-3 py-2">{item.name || "(empty)"}</td>
                      <td className="px-3 py-2">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2">
            <Link href="/calendar" className="btn-primary">
              View Schedule →
            </Link>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setStep(1);
                setFile(null);
                setPreviewData(null);
                setResult(null);
                setCsvBase64("");
                setUploadError("");
              }}
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
