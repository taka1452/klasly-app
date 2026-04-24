"use client";

import { useMemo, useState } from "react";
import type { CustomForm, FormField } from "@/lib/forms/types";

type Props = {
  form: CustomForm;
};

type Responses = Record<string, string | string[] | boolean>;

export default function PublicFormClient({ form }: Props) {
  const [responses, setResponses] = useState<Responses>({});
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [submitterPhone, setSubmitterPhone] = useState("");
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Auto-pick submitter_name / submitter_email from fields if the form has
  // matching built-in fields — keeps tables clean for the studio.
  const nameFieldId = useMemo(() => {
    const f = form.fields.find((x) =>
      /name/i.test(x.label) && x.type === "text"
    );
    return f?.id ?? null;
  }, [form.fields]);
  const emailFieldId = useMemo(() => {
    const f = form.fields.find((x) => x.type === "email");
    return f?.id ?? null;
  }, [form.fields]);
  const phoneFieldId = useMemo(() => {
    const f = form.fields.find((x) => x.type === "tel");
    return f?.id ?? null;
  }, [form.fields]);

  function setResp(fieldId: string, value: string | string[] | boolean) {
    setResponses((r) => ({ ...r, [fieldId]: value }));
    if (fieldId === nameFieldId && typeof value === "string") setSubmitterName(value);
    if (fieldId === emailFieldId && typeof value === "string") setSubmitterEmail(value);
    if (fieldId === phoneFieldId && typeof value === "string") setSubmitterPhone(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/forms/${form.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responses,
        submitter_name: submitterName,
        submitter_email: submitterEmail,
        submitter_phone: submitterPhone,
        signature_data: form.requires_signature ? signature : null,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to submit");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
          ✓
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Submitted</h2>
        <p className="mt-2 text-sm text-gray-600">
          {form.success_message ||
            "Thanks — we've received your submission."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold text-gray-900">{form.name}</h1>
      {form.intro_text && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{form.intro_text}</p>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {form.fields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={responses[field.id]}
            onChange={(v) => setResp(field.id, v)}
          />
        ))}

        {form.requires_signature && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Signature <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Type your full legal name to sign"
              required
              className="input-field w-full"
            />
            <p className="mt-1 text-xs text-gray-500">
              Typing your name constitutes an electronic signature.
            </p>
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string | string[] | boolean | undefined;
  onChange: (v: string | string[] | boolean) => void;
}) {
  const req = field.required ? <span className="text-red-600"> *</span> : null;

  if (field.type === "textarea") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {field.label}
          {req}
        </label>
        <textarea
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={4}
          className="input-field w-full"
        />
        {field.help_text && <p className="mt-1 text-xs text-gray-500">{field.help_text}</p>}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {field.label}
          {req}
        </label>
        <select
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="input-field w-full"
        >
          <option value="">Select…</option>
          {(field.options || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {field.help_text && <p className="mt-1 text-xs text-gray-500">{field.help_text}</p>}
      </div>
    );
  }

  if (field.type === "radio") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {field.label}
          {req}
        </label>
        <div className="space-y-1">
          {(field.options || []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name={field.id}
                checked={value === o}
                onChange={() => onChange(o)}
                required={field.required}
              />
              {o}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "checkbox") {
    const current = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {field.label}
          {req}
        </label>
        <div className="space-y-1">
          {(field.options || []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={current.includes(o)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? Array.from(new Set([...current, o]))
                    : current.filter((c) => c !== o);
                  onChange(next);
                }}
              />
              {o}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "acknowledgement") {
    return (
      <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          required={field.required}
          className="mt-0.5"
        />
        <span>
          {field.acknowledgement_text || field.label}
          {req}
        </span>
      </label>
    );
  }

  if (field.type === "signature") {
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {field.label}
          {req}
        </label>
        <input
          type="text"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          placeholder="Type your full legal name"
          className="input-field w-full"
        />
        <p className="mt-1 text-xs text-gray-500">
          Typing your name constitutes an electronic signature.
        </p>
      </div>
    );
  }

  const inputType =
    field.type === "email"
      ? "email"
      : field.type === "tel"
        ? "tel"
        : field.type === "date"
          ? "date"
          : "text";

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {field.label}
        {req}
      </label>
      <input
        type={inputType}
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
        className="input-field w-full"
      />
      {field.help_text && <p className="mt-1 text-xs text-gray-500">{field.help_text}</p>}
    </div>
  );
}
