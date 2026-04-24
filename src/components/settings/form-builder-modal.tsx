"use client";

import { useState } from "react";
import type { CustomForm, FormField, FormFieldType } from "@/lib/forms/types";

type Props = {
  form: CustomForm;
  onClose: () => void;
  onSaved: () => void;
};

const FIELD_TYPE_OPTIONS: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Paragraph" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Single choice" },
  { value: "checkbox", label: "Multiple choice" },
  { value: "signature", label: "Signature" },
  { value: "acknowledgement", label: "Acknowledgement" },
];

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export default function FormBuilderModal({ form, onClose, onSaved }: Props) {
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description || "");
  const [introText, setIntroText] = useState(form.intro_text || "");
  const [successMessage, setSuccessMessage] = useState(form.success_message || "");
  const [fields, setFields] = useState<FormField[]>(form.fields || []);
  const [requiresSignature, setRequiresSignature] = useState(form.requires_signature);
  const [isActive, setIsActive] = useState(form.is_active);
  const [isPublic, setIsPublic] = useState(form.is_public);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(index: number, patch: Partial<FormField>) {
    setFields((fs) => fs.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields((fs) => fs.filter((_, i) => i !== index));
  }

  function addField() {
    setFields((fs) => [
      ...fs,
      {
        id: uid(),
        label: "New field",
        type: "text",
        required: false,
      },
    ]);
  }

  function move(index: number, dir: -1 | 1) {
    setFields((fs) => {
      const copy = [...fs];
      const j = index + dir;
      if (j < 0 || j >= copy.length) return copy;
      [copy[index], copy[j]] = [copy[j], copy[index]];
      return copy;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/forms/${form.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        intro_text: introText,
        success_message: successMessage,
        fields,
        requires_signature: requiresSignature,
        is_active: isActive,
        is_public: isPublic,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h3 className="text-base font-semibold text-gray-900">Edit form</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            ×
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="max-h-[70vh] overflow-auto p-4">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Form name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field w-full"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Active — can receive submissions
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Public — reachable without login
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={requiresSignature}
                  onChange={(e) => setRequiresSignature(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Require signature
              </label>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Description (admin only)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Intro text (shown above the form)
              </label>
              <textarea
                value={introText}
                onChange={(e) => setIntroText(e.target.value)}
                rows={2}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Success message (shown after submit)
              </label>
              <textarea
                value={successMessage}
                onChange={(e) => setSuccessMessage(e.target.value)}
                rows={2}
                placeholder="Thanks! We'll be in touch."
                className="input-field w-full"
              />
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Fields</h4>
                <button
                  type="button"
                  onClick={addField}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                >
                  + Add field
                </button>
              </div>
              <ol className="space-y-2">
                {fields.map((f, i) => (
                  <li key={f.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={f.label}
                        onChange={(e) => updateField(i, { label: e.target.value })}
                        className="input-field flex-1 min-w-[200px]"
                      />
                      <select
                        value={f.type}
                        onChange={(e) =>
                          updateField(i, { type: e.target.value as FormFieldType })
                        }
                        className="input-field w-40"
                      >
                        {FIELD_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={f.required}
                          onChange={(e) => updateField(i, { required: e.target.checked })}
                          className="h-3 w-3 rounded border-gray-300"
                        />
                        Required
                      </label>
                      <div className="ml-auto flex gap-1">
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          className="rounded border border-gray-200 px-2 py-0.5 text-xs disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, +1)}
                          disabled={i === fields.length - 1}
                          className="rounded border border-gray-200 px-2 py-0.5 text-xs disabled:opacity-40"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeField(i)}
                          className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {(f.type === "select" || f.type === "radio" || f.type === "checkbox") && (
                      <div className="mt-2">
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Options (comma separated)
                        </label>
                        <input
                          type="text"
                          value={(f.options || []).join(", ")}
                          onChange={(e) =>
                            updateField(i, {
                              options: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          className="input-field w-full text-sm"
                        />
                      </div>
                    )}

                    {f.type === "acknowledgement" && (
                      <div className="mt-2">
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Acknowledgement text
                        </label>
                        <textarea
                          value={f.acknowledgement_text || ""}
                          onChange={(e) =>
                            updateField(i, { acknowledgement_text: e.target.value })
                          }
                          rows={2}
                          className="input-field w-full text-sm"
                        />
                      </div>
                    )}

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={f.placeholder || ""}
                        onChange={(e) => updateField(i, { placeholder: e.target.value })}
                        placeholder="Placeholder (optional)"
                        className="input-field w-full text-sm"
                      />
                      <input
                        type="text"
                        value={f.help_text || ""}
                        onChange={(e) => updateField(i, { help_text: e.target.value })}
                        placeholder="Help text (optional)"
                        className="input-field w-full text-sm"
                      />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
