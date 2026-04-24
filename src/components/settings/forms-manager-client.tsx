"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CustomForm, FormField, FormType } from "@/lib/forms/types";
import {
  DEFAULT_FIELDS_BY_TYPE,
  FORM_TYPE_ICON,
  FORM_TYPE_LABEL,
} from "@/lib/forms/types";
import FormBuilderModal from "@/components/settings/form-builder-modal";

type FormRow = CustomForm & { submission_count: number };

export default function FormsManagerClient() {
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<FormType | "all">("all");
  const [editing, setEditing] = useState<FormRow | null>(null);
  const [creating, setCreating] = useState<FormType | null>(null);
  const [showSubmissionsFor, setShowSubmissionsFor] = useState<FormRow | null>(null);

  const fetchForms = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/forms");
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to load forms");
      return;
    }
    setForms(await res.json());
    setError(null);
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  const filtered = useMemo(
    () =>
      typeFilter === "all" ? forms : forms.filter((f) => f.form_type === typeFilter),
    [forms, typeFilter]
  );

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  async function handleCreate(formType: FormType, overrides?: Partial<CustomForm>) {
    const defaultName = overrides?.name ?? `New ${FORM_TYPE_LABEL[formType]}`;
    const defaultFields: FormField[] =
      (overrides?.fields as FormField[] | undefined) ?? DEFAULT_FIELDS_BY_TYPE[formType];

    const res = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        form_type: formType,
        name: defaultName,
        fields: defaultFields,
        requires_signature: formType === "waiver" || formType === "contract",
        is_active: true,
        is_public: true,
        description: overrides?.description,
        intro_text: overrides?.intro_text,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      await fetchForms();
      setCreating(null);
      setEditing(created);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create form");
    }
  }

  async function toggleActive(f: FormRow) {
    const res = await fetch(`/api/forms/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !f.is_active }),
    });
    if (res.ok) await fetchForms();
  }

  async function remove(f: FormRow) {
    if (f.submission_count > 0) {
      if (!confirm(
        `"${f.name}" has ${f.submission_count} submission(s). Delete anyway? This cannot be undone.`
      ))
        return;
    } else if (!confirm(`Delete "${f.name}"?`)) {
      return;
    }
    const res = await fetch(`/api/forms/${f.id}`, { method: "DELETE" });
    if (res.ok) await fetchForms();
  }

  function copyPublicLink(f: FormRow) {
    const url = `${origin}/forms/${f.id}`;
    navigator.clipboard.writeText(url).catch(() => {
      /* ignore */
    });
  }

  return (
    <div>
      {/* Type filters + create button */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(["all", "waiver", "application", "contract", "medical_intake", "custom"] as const).map(
            (t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  typeFilter === t
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t === "all" ? "All" : FORM_TYPE_LABEL[t]}
              </button>
            )
          )}
        </div>
        <div className="relative ml-auto">
          <details className="group">
            <summary className="btn-primary cursor-pointer list-none">
              + New form
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
              {(["waiver", "application", "contract", "medical_intake", "custom"] as FormType[]).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCreating(t)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <span>{FORM_TYPE_ICON[t]}</span>
                    <span>{FORM_TYPE_LABEL[t]}</span>
                  </button>
                )
              )}
            </div>
          </details>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Forms grid */}
      {loading ? (
        <div className="card py-10 text-center text-sm text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card py-10 text-center">
          <p className="text-sm text-gray-500">No forms yet in this category.</p>
          <p className="mt-1 text-xs text-gray-400">
            Click <strong>+ New form</strong> to create one.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => (
            <div key={f.id} className="card flex flex-col">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700">
                  {FORM_TYPE_ICON[f.form_type as FormType]} {FORM_TYPE_LABEL[f.form_type as FormType]}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    f.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {f.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="font-semibold text-gray-900">{f.name}</div>
              {f.description && (
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                  {f.description}
                </p>
              )}
              <div className="mt-auto pt-3 text-xs text-gray-500">
                {f.fields.length} fields · {f.submission_count} submission
                {f.submission_count === 1 ? "" : "s"}
                {f.is_public ? " · public" : " · members-only"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(f)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => copyPublicLink(f)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                  title={`${origin}/forms/${f.id}`}
                >
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={() => setShowSubmissionsFor(f)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                >
                  Submissions ({f.submission_count})
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(f)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                >
                  {f.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(f)}
                  className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create: pick type, auto-seed fields, open editor */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreating(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900">
              New {FORM_TYPE_LABEL[creating]}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Start from a pre-filled template for {FORM_TYPE_LABEL[creating]}, or a blank form.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreate(creating, { fields: DEFAULT_FIELDS_BY_TYPE.custom })}
                className="btn-secondary"
              >
                Blank
              </button>
              <button
                type="button"
                onClick={() => handleCreate(creating)}
                className="btn-primary"
              >
                Use template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit */}
      {editing && (
        <FormBuilderModal
          form={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await fetchForms();
            setEditing(null);
          }}
        />
      )}

      {/* Submissions */}
      {showSubmissionsFor && (
        <SubmissionsModal
          form={showSubmissionsFor}
          onClose={() => setShowSubmissionsFor(null)}
        />
      )}
    </div>
  );
}

function SubmissionsModal({
  form,
  onClose,
}: {
  form: FormRow;
  onClose: () => void;
}) {
  type Submission = {
    id: string;
    submitter_name: string | null;
    submitter_email: string | null;
    responses: Record<string, unknown>;
    submitted_at: string;
    signature_data: string | null;
  };
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/forms/${form.id}/submit`);
      if (res.ok) setSubs(await res.json());
      setLoading(false);
    })();
  }, [form.id]);

  function exportCsv() {
    const fieldIds = form.fields.map((f) => f.id);
    const header = ["submitted_at", "submitter_name", "submitter_email", ...fieldIds];
    const rows = subs.map((s) => {
      const rec = s.responses || {};
      return [
        s.submitted_at,
        escapeCsv(s.submitter_name),
        escapeCsv(s.submitter_email),
        ...fieldIds.map((fid) => {
          const val = (rec as Record<string, unknown>)[fid];
          if (Array.isArray(val)) return escapeCsv(val.join("; "));
          return escapeCsv(val);
        }),
      ].join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.name.replace(/\s+/g, "-")}-submissions.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{form.name} submissions</h3>
            <p className="text-xs text-gray-500">{subs.length} total</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={subs.length === 0}
              className="btn-secondary"
            >
              ↓ CSV
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-auto p-4">
          {loading ? (
            <p className="py-6 text-center text-sm text-gray-500">Loading...</p>
          ) : subs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No submissions yet.</p>
          ) : (
            <ul className="space-y-3">
              {subs.map((s) => (
                <li key={s.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.submitter_name || "Anonymous"}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(s.submitted_at).toLocaleString()}
                    </span>
                  </div>
                  {s.submitter_email && (
                    <div className="text-xs text-gray-500">{s.submitter_email}</div>
                  )}
                  <dl className="mt-2 space-y-1">
                    {form.fields.map((f) => {
                      if (f.type === "acknowledgement") return null;
                      const val = (s.responses || {})[f.id];
                      if (val === undefined || val === null || val === "") return null;
                      return (
                        <div key={f.id} className="flex gap-2 text-xs">
                          <dt className="min-w-[120px] font-medium text-gray-600">{f.label}</dt>
                          <dd className="text-gray-900">
                            {Array.isArray(val) ? (val as string[]).join(", ") : String(val)}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  {s.signature_data && (
                    <div className="mt-2 text-xs text-gray-500">Signed ✓</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
