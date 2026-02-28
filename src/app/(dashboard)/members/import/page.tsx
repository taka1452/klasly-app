"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  normalizePlanType,
  normalizeStatus,
  parseCredits,
} from "@/lib/import/csv-utils";
import { getPlanLabel } from "@/lib/utils";

const SKIP = "— Skip —";
const NAME_COMBINED = "combined";
const NAME_SEPARATE = "separate";

const PLAN_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "pack", label: "Pack" },
  { value: "drop_in", label: "Drop-in" },
] as const;

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
] as const;

function autoMapColumns(columns: string[]): {
  nameMode: "combined" | "separate";
  firstNameColumn: string;
  lastNameColumn: string;
  combinedNameColumn: string;
  emailColumn: string;
  phoneColumn: string;
  planTypeColumn: string;
  creditsColumn: string;
  statusColumn: string;
  notesColumn: string;
} {
  const lower = (s: string) => s.trim().toLowerCase();
  const first = columns.find(
    (c) =>
      /first\s*name|firstname/i.test(c) || lower(c) === "first_name"
  );
  const last = columns.find(
    (c) =>
      /last\s*name|lastname/i.test(c) || lower(c) === "last_name"
  );
  const combined = columns.find(
    (c) =>
      /^name$|full\s*name|client\s*name/i.test(c) || lower(c) === "full_name"
  );
  const email = columns.find(
    (c) =>
      /^email$|e-?mail|email\s*address/i.test(c)
  );
  const phone = columns.find(
    (c) =>
      /^phone$|mobile|cell/i.test(c)
  );
  const plan = columns.find(
    (c) =>
      /plan|pricing|option/i.test(c)
  );
  const credits = columns.find(
    (c) =>
      /credit/i.test(c)
  );
  const status = columns.find(
    (c) =>
      /status|member\s*status/i.test(c)
  );
  const notes = columns.find(
    (c) =>
      /note/i.test(c)
  );

  const nameMode =
    first && last ? NAME_SEPARATE : combined ? NAME_COMBINED : NAME_SEPARATE;

  return {
    nameMode,
    firstNameColumn: first || "",
    lastNameColumn: last || "",
    combinedNameColumn: combined || "",
    emailColumn: email || "",
    phoneColumn: phone || "",
    planTypeColumn: plan || "",
    creditsColumn: credits || "",
    statusColumn: status || "",
    notesColumn: notes || "",
  };
}

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

export default function ImportMembersPage() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvBase64, setCsvBase64] = useState<string>("");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const [nameMode, setNameMode] = useState<"combined" | "separate">("combined");
  const [firstNameColumn, setFirstNameColumn] = useState("");
  const [lastNameColumn, setLastNameColumn] = useState("");
  const [combinedNameColumn, setCombinedNameColumn] = useState("");
  const [emailColumn, setEmailColumn] = useState("");
  const [phoneColumn, setPhoneColumn] = useState("");
  const [planTypeColumn, setPlanTypeColumn] = useState("");
  const [planTypeFixed, setPlanTypeFixed] = useState<string>("drop_in");
  const [creditsColumn, setCreditsColumn] = useState("");
  const [creditsFixed, setCreditsFixed] = useState<number>(0);
  const [statusColumn, setStatusColumn] = useState("");
  const [statusFixed, setStatusFixed] = useState<string>("active");
  const [notesColumn, setNotesColumn] = useState("");

  const [defaultPlanType, setDefaultPlanType] = useState<string>("drop_in");
  const [defaultCredits, setDefaultCredits] = useState(0);
  const [defaultStatus, setDefaultStatus] = useState<string>("active");
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(false);

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const columns = useMemo(
    () => previewData?.columns ?? [],
    [previewData?.columns]
  );
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
          ? [getCell(row, firstNameColumn), getCell(row, lastNameColumn)]
              .filter(Boolean)
              .join(" ")
          : getCell(row, combinedNameColumn);
      const planType =
        planTypeColumn && columns.includes(planTypeColumn)
          ? normalizePlanType(getCell(row, planTypeColumn))
          : planTypeFixed;
      const credits =
        creditsColumn && columns.includes(creditsColumn)
          ? parseCredits(getCell(row, creditsColumn))
          : creditsFixed;
      const status =
        statusColumn && columns.includes(statusColumn)
          ? normalizeStatus(getCell(row, statusColumn))
          : statusFixed;
      return {
        name: fullName || "—",
        email: getCell(row, emailColumn) || "—",
        phone: getCell(row, phoneColumn) || "—",
        planType: getPlanLabel(planType),
        credits: planType === "monthly" ? "Unlimited" : String(credits),
        status: status.charAt(0).toUpperCase() + status.slice(1),
        notes: getCell(row, notesColumn) || "—",
      };
    },
    [
      nameMode,
      firstNameColumn,
      lastNameColumn,
      combinedNameColumn,
      emailColumn,
      phoneColumn,
      planTypeColumn,
      planTypeFixed,
      creditsColumn,
      creditsFixed,
      statusColumn,
      statusFixed,
      notesColumn,
      columns,
      getCell,
    ]
  );

  async function handleFile(f: File) {
    setUploadError("");
    const name = (f.name || "").toLowerCase();
    if (!name.endsWith(".csv")) {
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
        setUploadError(data.error || "Failed to read file.");
        return;
      }
      const data = (await res.json()) as PreviewData;
      setPreviewData(data);
      setFile(f);

      const reader = new FileReader();
      reader.onload = () => {
        const str = (reader.result as string) || "";
        const base64 = btoa(unescape(encodeURIComponent(str)));
        setCsvBase64(base64);
      };
      reader.readAsText(f, "UTF-8");

      const auto = autoMapColumns(data.columns);
      setNameMode(auto.nameMode);
      setFirstNameColumn(auto.firstNameColumn);
      setLastNameColumn(auto.lastNameColumn);
      setCombinedNameColumn(auto.combinedNameColumn);
      setEmailColumn(auto.emailColumn);
      setPhoneColumn(auto.phoneColumn);
      setPlanTypeColumn(auto.planTypeColumn);
      setCreditsColumn(auto.creditsColumn);
      setStatusColumn(auto.statusColumn);
      setNotesColumn(auto.notesColumn);

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
      const mapping: Record<string, string> = {
        full_name: nameMode === NAME_COMBINED ? combinedNameColumn : "",
        email: emailColumn,
        phone: phoneColumn,
        plan_type: planTypeColumn || planTypeFixed,
        credits: creditsColumn || String(creditsFixed),
        status: statusColumn || statusFixed,
        notes: notesColumn,
      };

      const res = await fetch("/api/import/execute", {
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
            phone: phoneColumn,
            plan_type: planTypeColumn || undefined,
            credits: creditsColumn || undefined,
            status: statusColumn || undefined,
            notes: notesColumn || undefined,
          },
          defaultPlanType,
          defaultCredits: defaultCredits,
          defaultStatus,
          sendWelcomeEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Import failed.");
        return;
      }
      setResult(data as ImportResult);
      setStep(4);
    } finally {
      setImporting(false);
    }
  }

  const dropdownOptions = [SKIP, ...columns];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href="/members"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to members
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {step === 1 && "Import Members from CSV"}
          {step === 2 && "Map Your Columns"}
          {step === 3 && "Review & Confirm"}
          {step === 4 && "Import Complete!"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {step === 1 &&
            "Switching from Mindbody, Zen Planner, or a spreadsheet? Import your members in minutes."}
          {step === 2 && "Tell us which columns in your CSV match Klasly's fields."}
          {step === 3 && "Set defaults and confirm."}
          {step === 4 && "Summary of your import."}
        </p>
      </div>

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
            <p className="mt-1 text-xs text-gray-400">
              .csv up to 5MB
            </p>
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
            <label
              htmlFor="csv-upload"
              className="btn-primary mt-4 cursor-pointer"
            >
              {uploading ? "Reading…" : "Choose file"}
            </label>
          </div>
          {uploadError && (
            <p className="mt-3 text-sm text-red-600">{uploadError}</p>
          )}
          <p className="mt-6 text-center text-sm text-gray-500">
            <a
              href="/api/import/template"
              download="klasly-member-import-template.csv"
              className="text-brand-600 hover:text-brand-700"
            >
              Download Template
            </a>
          </p>
        </div>
      )}

      {step === 2 && previewData && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name ★
                </label>
                <div className="mt-1 flex gap-2">
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
                    className="input-field mt-1 w-full"
                    value={combinedNameColumn}
                    onChange={(e) => setCombinedNameColumn(e.target.value)}
                  >
                    {dropdownOptions.map((c) => (
                      <option key={c} value={c === SKIP ? "" : c}>
                        {c}
                      </option>
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
                        <option key={c} value={c === SKIP ? "" : c}>
                          First: {c}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input-field flex-1"
                      value={lastNameColumn}
                      onChange={(e) => setLastNameColumn(e.target.value)}
                    >
                      {dropdownOptions.map((c) => (
                        <option key={c} value={c === SKIP ? "" : c}>
                          Last: {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email ★
                </label>
                <select
                  className="input-field mt-1 w-full"
                  value={emailColumn}
                  onChange={(e) => setEmailColumn(e.target.value)}
                >
                  {dropdownOptions.map((c) => (
                    <option key={c} value={c === SKIP ? "" : c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <select
                  className="input-field mt-1 w-full"
                  value={phoneColumn}
                  onChange={(e) => setPhoneColumn(e.target.value)}
                >
                  {dropdownOptions.map((c) => (
                    <option key={c} value={c === SKIP ? "" : c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Plan Type
                </label>
                <select
                  className="input-field mt-1 w-full"
                  value={planTypeColumn || `fixed:${planTypeFixed}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.startsWith("fixed:")) {
                      setPlanTypeColumn("");
                      setPlanTypeFixed(v.slice(6));
                    } else {
                      setPlanTypeColumn(v);
                    }
                  }}
                >
                  <option value="">— From CSV —</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {PLAN_OPTIONS.map((o) => (
                    <option key={o.value} value={`fixed:${o.value}`}>
                      Fixed: {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Credits
                </label>
                <select
                  className="input-field mt-1 w-full"
                  value={creditsColumn || "fixed"}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "fixed") {
                      setCreditsColumn("");
                    } else {
                      setCreditsColumn(v);
                    }
                  }}
                >
                  <option value="fixed">Fixed value</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {(!creditsColumn || !columns.includes(creditsColumn)) && (
                  <input
                    type="number"
                    min={0}
                    className="input-field mt-1 w-full"
                    value={creditsFixed}
                    onChange={(e) =>
                      setCreditsFixed(parseInt(e.target.value, 10) || 0)
                    }
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  className="input-field mt-1 w-full"
                  value={statusColumn || `fixed:${statusFixed}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.startsWith("fixed:")) {
                      setStatusColumn("");
                      setStatusFixed(v.slice(6));
                    } else {
                      setStatusColumn(v);
                    }
                  }}
                >
                  <option value="">— From CSV —</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={`fixed:${o.value}`}>
                      Fixed: {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <select
                  className="input-field mt-1 w-full"
                  value={notesColumn}
                  onChange={(e) => setNotesColumn(e.target.value)}
                >
                  {dropdownOptions.map((c) => (
                    <option key={c} value={c === SKIP ? "" : c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">
                Preview (first 5 rows)
              </p>
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                      <th className="px-3 py-2 text-left font-medium">Phone</th>
                      <th className="px-3 py-2 text-left font-medium">Plan</th>
                      <th className="px-3 py-2 text-left font-medium">Credits</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview.slice(0, 5).map((row, i) => {
                      const r = getMappedRow(row);
                      return (
                        <tr key={i} className="border-b">
                          <td className="px-3 py-2">{r.name}</td>
                          <td className="px-3 py-2">{r.email}</td>
                          <td className="px-3 py-2">{r.phone}</td>
                          <td className="px-3 py-2">{r.planType}</td>
                          <td className="px-3 py-2">{r.credits}</td>
                          <td className="px-3 py-2">{r.status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setStep(3)}
                disabled={!emailColumn}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700">
              Defaults (when not from CSV)
            </h3>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm text-gray-600">
                  Default Plan Type
                </label>
                <div className="mt-1 flex gap-4">
                  {PLAN_OPTIONS.map((o) => (
                    <label key={o.value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="defaultPlan"
                        checked={defaultPlanType === o.value}
                        onChange={() => setDefaultPlanType(o.value)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
              {defaultPlanType === "pack" && (
                <div>
                  <label className="block text-sm text-gray-600">
                    Default Credits
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="input-field mt-1 w-32"
                    value={defaultCredits}
                    onChange={(e) =>
                      setDefaultCredits(parseInt(e.target.value, 10) || 0)
                    }
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-600">
                  Default Status
                </label>
                <div className="mt-1 flex gap-4">
                  {STATUS_OPTIONS.map((o) => (
                    <label key={o.value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="defaultStatus"
                        checked={defaultStatus === o.value}
                        onChange={() => setDefaultStatus(o.value)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sendWelcomeEmail}
              onChange={(e) => setSendWelcomeEmail(e.target.checked)}
            />
            <span className="text-sm">
              Send a welcome email to all imported members
            </span>
          </label>

          <div className="rounded-lg bg-gray-50 p-4">
            <p className="font-medium text-gray-900">
              {totalRows} members will be imported
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Plan: {getPlanLabel(defaultPlanType)} (default)
            </p>
            <p className="text-sm text-gray-500">
              Welcome email: {sendWelcomeEmail ? "Yes" : "No"}
            </p>
          </div>

          <p className="text-sm text-amber-700">
            Members will NOT have login access. You can invite them to sign up
            separately.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={runImport}
              disabled={importing || !emailColumn}
            >
              {importing ? "Importing…" : "Import Members"}
            </button>
          </div>
        </div>
      )}

      {step === 4 && result && (
        <div className="card space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">
                {result.summary.imported}
              </p>
              <p className="text-sm text-green-600">imported</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">
                {result.summary.skipped}
              </p>
              <p className="text-sm text-amber-600">skipped</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-700">
                {result.summary.errors}
              </p>
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
                      <td className="px-3 py-2">
                        {item.email || "(empty)"}
                      </td>
                      <td className="px-3 py-2">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2">
            <Link href="/members" className="btn-primary">
              View Members →
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
