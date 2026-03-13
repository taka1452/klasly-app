"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { validateEmail } from "@/lib/import/csv-utils";

const SKIP = "— Skip —";
const NAME_COMBINED = "combined";
const NAME_SEPARATE = "separate";

type PreviewData = {
  columns: string[];
  preview: Record<string, string>[];
  totalRows: number;
};

type ImportResult = {
  success: boolean;
  summary: { total: number; imported: number; skipped: number; errors: number };
  skipped: { row: number; email: string; reason: string }[];
  errors: { row: number; email: string; reason: string }[];
};

function autoMapColumns(columns: string[]): {
  nameMode: "combined" | "separate";
  firstNameColumn: string;
  lastNameColumn: string;
  combinedNameColumn: string;
  emailColumn: string;
  phoneColumn: string;
  bioColumn: string;
  specialtiesColumn: string;
} {
  const first = columns.find((c) => /first\s*name|firstname/i.test(c) || c.toLowerCase() === "first_name");
  const last = columns.find((c) => /last\s*name|lastname/i.test(c) || c.toLowerCase() === "last_name");
  const combined = columns.find((c) => /^name$|full\s*name|instructor\s*name/i.test(c) || c.toLowerCase() === "full_name");
  const email = columns.find((c) => /^email$|e-?mail|email\s*address/i.test(c));
  const phone = columns.find((c) => /^phone$|mobile|cell/i.test(c));
  const bio = columns.find((c) => /bio|about|description/i.test(c));
  const specialties = columns.find((c) => /specialt|skill|focus/i.test(c));

  return {
    nameMode: first && last ? NAME_SEPARATE : NAME_COMBINED,
    firstNameColumn: first ?? "",
    lastNameColumn: last ?? "",
    combinedNameColumn: combined ?? "",
    emailColumn: email ?? "",
    phoneColumn: phone ?? "",
    bioColumn: bio ?? "",
    specialtiesColumn: specialties ?? "",
  };
}

export default function ImportInstructorsPage() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvBase64, setCsvBase64] = useState<string>("");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const [nameMode, setNameMode] = useState<"combined" | "separate">(NAME_COMBINED);
  const [firstNameColumn, setFirstNameColumn] = useState("");
  const [lastNameColumn, setLastNameColumn] = useState("");
  const [combinedNameColumn, setCombinedNameColumn] = useState("");
  const [emailColumn, setEmailColumn] = useState("");
  const [phoneColumn, setPhoneColumn] = useState("");
  const [bioColumn, setBioColumn] = useState("");
  const [specialtiesColumn, setSpecialtiesColumn] = useState("");

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const columns = useMemo(() => previewData?.columns ?? [], [previewData?.columns]);
  const totalRows = previewData?.totalRows ?? 0;

  const getCell = useCallback(
    (row: Record<string, string>, col: string) =>
      col && col !== SKIP ? (row[col] ?? "").trim() : "",
    []
  );

  const getMappedRow = useCallback(
    (row: Record<string, string>) => {
      const fullName =
        nameMode === NAME_SEPARATE
          ? [getCell(row, firstNameColumn), getCell(row, lastNameColumn)].filter(Boolean).join(" ")
          : getCell(row, combinedNameColumn);
      const email = getCell(row, emailColumn);
      const phone = getCell(row, phoneColumn);
      const bio = getCell(row, bioColumn);
      const specialties = getCell(row, specialtiesColumn);
      return {
        name: fullName || "—",
        email: email || "—",
        emailValid: !email || validateEmail(email),
        phone: phone || "—",
        bio: bio ? (bio.length > 40 ? bio.slice(0, 40) + "…" : bio) : "—",
        specialties: specialties || "—",
      };
    },
    [nameMode, firstNameColumn, lastNameColumn, combinedNameColumn, emailColumn, phoneColumn, bioColumn, specialtiesColumn, getCell]
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
      setNameMode(auto.nameMode);
      setFirstNameColumn(auto.firstNameColumn);
      setLastNameColumn(auto.lastNameColumn);
      setCombinedNameColumn(auto.combinedNameColumn);
      setEmailColumn(auto.emailColumn);
      setPhoneColumn(auto.phoneColumn);
      setBioColumn(auto.bioColumn);
      setSpecialtiesColumn(auto.specialtiesColumn);

      setStep(2);
    } finally {
      setUploading(false);
    }
  }

  async function runImport() {
    if (!csvBase64 || !previewData) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch("/api/import/instructors/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvData: csvBase64,
          nameMode,
          firstNameColumn: nameMode === NAME_SEPARATE ? firstNameColumn : undefined,
          lastNameColumn: nameMode === NAME_SEPARATE ? lastNameColumn : undefined,
          combinedNameColumn: nameMode === NAME_COMBINED ? combinedNameColumn : undefined,
          mapping: {
            email: emailColumn,
            phone: phoneColumn || undefined,
            bio: bioColumn || undefined,
            specialties: specialtiesColumn || undefined,
          },
        }),
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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/instructors" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to instructors
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {step === 1 && "Import Instructors from CSV"}
          {step === 2 && "Map Your Columns"}
          {step === 3 && "Import Complete!"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {step === 1 && "Bulk-add instructors from a spreadsheet or another system."}
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
          <p className="mt-6 text-center text-sm text-gray-500">
            <a
              href="/api/import/instructors/template"
              download="klasly-instructor-import-template.csv"
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
              {/* Name */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Name ★</label>
                <div className="mt-1 flex gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={nameMode === NAME_COMBINED}
                      onChange={() => setNameMode(NAME_COMBINED)}
                    />
                    One column
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={nameMode === NAME_SEPARATE}
                      onChange={() => setNameMode(NAME_SEPARATE)}
                    />
                    First + Last
                  </label>
                </div>
                {nameMode === NAME_COMBINED ? (
                  <select
                    className="input-field mt-1 w-full sm:w-64"
                    value={combinedNameColumn}
                    onChange={(e) => setCombinedNameColumn(e.target.value)}
                  >
                    {dropdownOptions.map((c) => (
                      <option key={c} value={c === SKIP ? "" : c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 flex gap-2">
                    <select
                      className="input-field flex-1"
                      value={firstNameColumn}
                      onChange={(e) => setFirstNameColumn(e.target.value)}
                    >
                      {dropdownOptions.map((c) => (
                        <option key={c} value={c === SKIP ? "" : c}>First: {c}</option>
                      ))}
                    </select>
                    <select
                      className="input-field flex-1"
                      value={lastNameColumn}
                      onChange={(e) => setLastNameColumn(e.target.value)}
                    >
                      {dropdownOptions.map((c) => (
                        <option key={c} value={c === SKIP ? "" : c}>Last: {c}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Email ★</label>
                <select
                  className="input-field mt-1 w-full"
                  value={emailColumn}
                  onChange={(e) => setEmailColumn(e.target.value)}
                >
                  {dropdownOptions.map((c) => (
                    <option key={c} value={c === SKIP ? "" : c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <select
                  className="input-field mt-1 w-full"
                  value={phoneColumn}
                  onChange={(e) => setPhoneColumn(e.target.value)}
                >
                  {dropdownOptions.map((c) => (
                    <option key={c} value={c === SKIP ? "" : c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Bio</label>
                <select
                  className="input-field mt-1 w-full"
                  value={bioColumn}
                  onChange={(e) => setBioColumn(e.target.value)}
                >
                  {dropdownOptions.map((c) => (
                    <option key={c} value={c === SKIP ? "" : c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Specialties */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Specialties
                  <span className="ml-1 text-xs font-normal text-gray-400">(comma-separated)</span>
                </label>
                <select
                  className="input-field mt-1 w-full"
                  value={specialtiesColumn}
                  onChange={(e) => setSpecialtiesColumn(e.target.value)}
                >
                  {dropdownOptions.map((c) => (
                    <option key={c} value={c === SKIP ? "" : c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview table */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Preview (first 5 rows)</p>
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                      <th className="px-3 py-2 text-left font-medium">Phone</th>
                      <th className="px-3 py-2 text-left font-medium">Specialties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview.slice(0, 5).map((row, i) => {
                      const r = getMappedRow(row);
                      return (
                        <tr key={i} className="border-b">
                          <td className="px-3 py-2">{r.name}</td>
                          <td className={`px-3 py-2 ${!r.emailValid ? "text-red-500" : ""}`}>
                            {r.email}
                            {!r.emailValid && <span className="ml-1 text-xs">(invalid)</span>}
                          </td>
                          <td className="px-3 py-2">{r.phone}</td>
                          <td className="px-3 py-2">{r.specialties}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note */}
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Note:</strong> Imported instructors will not have login access yet. You can
              invite them individually from their profile page after import.
            </div>

            {/* Summary + buttons */}
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="font-medium text-gray-900">{totalRows} instructors will be imported</p>
              <p className="mt-0.5 text-sm text-gray-500">File: {file?.name}</p>
            </div>

            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={runImport}
                disabled={importing || !emailColumn}
              >
                {importing ? "Importing…" : "Import Instructors"}
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
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {[...result.skipped, ...result.errors].map((item, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2">{item.row}</td>
                      <td className="px-3 py-2">{item.email || "(empty)"}</td>
                      <td className="px-3 py-2">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2">
            <Link href="/instructors" className="btn-primary">
              View Instructors →
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
