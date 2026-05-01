"use client";

import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";

/**
 * Public contract-signing surface. Fetches the envelope + form by
 * sign_token, renders the form fields, captures a typed-name signature,
 * and submits.
 *
 * Kept deliberately small and self-contained — this page is sometimes
 * the very first time a future instructor or partner sees Klasly, so
 * we want it to load instantly without the dashboard shell.
 */

type FormField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  help_text?: string;
};

type LoadedData = {
  envelope: {
    id: string;
    title: string;
    status: string;
    studio_name: string;
  };
  signer: {
    id: string;
    name: string;
    email: string;
    role_label: string | null;
    status: string;
    signed_at: string | null;
    sign_order: number;
    total_signers: number;
  };
  form: {
    id: string;
    name: string;
    intro_text: string | null;
    success_message: string | null;
    fields: FormField[];
    requires_signature: boolean;
  };
};

export default function ContractSignClient({ token }: { token: string }) {
  const [data, setData] = useState<LoadedData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string | boolean | string[]>>({});
  const [signatureName, setSignatureName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/contracts/sign/${token}`);
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          if (!cancelled) setLoadError(payload.error || "Invalid signing link");
          return;
        }
        const json = (await res.json()) as LoadedData;
        if (!cancelled) {
          setData(json);
          if (json.signer.status === "signed") setSubmitted(true);
          // Pre-fill the signature name with the signer's known name as
          // a convenience — they can always override.
          setSignatureName(json.signer.name);
        }
      } catch {
        if (!cancelled) setLoadError("Couldn't reach the server");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSubmitError(null);

    if (!signatureName.trim()) {
      setSubmitError("Please type your full name to sign.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/contracts/sign/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responses,
        signature_data: signatureName.trim(),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setSubmitError(payload.error || "Couldn't submit your signature. Try again.");
      return;
    }
    setSubmitted(true);
  }

  async function handleDecline() {
    if (!data) return;
    if (!confirm("Decline this contract? The studio will be notified and can send a new envelope later.")) {
      return;
    }
    setDeclining(true);
    const res = await fetch(`/api/contracts/sign/${token}`, { method: "DELETE" });
    setDeclining(false);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setSubmitError(payload.error || "Couldn't record your decline.");
      return;
    }
    setDeclined(true);
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md py-16 px-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900">{loadError}</h1>
        <p className="mt-2 text-sm text-gray-500">
          The signing link may have expired or already been used. Reach out
          to the studio for a fresh invite.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {/* spin-fast = 600ms (vs default 1s) — first impression to an
            external signer, perceived speed matters here. */}
        <div className="spin-fast h-6 w-6 rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="panel-enter mx-auto max-w-md py-16 px-6 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold text-gray-900">
          Thanks, {data.signer.name.split(" ")[0]}!
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {data.signer.sign_order < data.signer.total_signers
            ? `Your signature is recorded. We'll let the next signer know it's their turn.`
            : `Every signer has now signed ${data.envelope.title}. ${data.envelope.studio_name} will follow up if anything else is needed.`}
        </p>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="panel-enter mx-auto max-w-md py-16 px-6 text-center">
        <h1 className="text-xl font-semibold text-gray-900">
          Declined
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          We've let {data.envelope.studio_name} know you couldn't sign this
          contract. They can reach out or send a fresh envelope when
          things change.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-10 px-4">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {data.envelope.studio_name}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">
          {data.envelope.title}
        </h1>
        {data.signer.total_signers > 1 && (
          <p className="mt-2 text-xs text-gray-500">
            Signer {data.signer.sign_order} of {data.signer.total_signers}
            {data.signer.role_label ? ` · ${data.signer.role_label}` : ""}
          </p>
        )}
      </div>

      {data.form.intro_text && (
        <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          {data.form.intro_text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {data.form.fields.map((f) => (
          <FieldRow
            key={f.id}
            field={f}
            value={responses[f.id]}
            onChange={(v) => setResponses((r) => ({ ...r, [f.id]: v }))}
          />
        ))}

        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
            Type your full name to sign
          </label>
          <input
            type="text"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="Full name as it appears on your ID"
            className="input-field mt-2 w-full font-serif text-lg italic"
            required
          />
          <p className="mt-2 text-[11px] text-gray-500">
            By typing your name and clicking Sign, you agree this is your
            electronic signature on the contract above.
          </p>
        </div>

        {submitError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </p>
        )}

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleDecline}
            disabled={submitting || declining}
            className="text-xs text-gray-500 underline-offset-2 transition-colors duration-150 hover:text-gray-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 disabled:opacity-50"
          >
            {declining ? "Declining…" : "I can't sign this"}
          </button>
          <button
            type="submit"
            disabled={submitting || declining}
            className="btn-primary min-w-[160px]"
          >
            <span className="label-swap" data-pending={submitting}>
              {submitting ? "Signing…" : "Sign contract"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string | boolean | string[] | undefined;
  onChange: (v: string | boolean | string[]) => void;
}) {
  const labelEl = (
    <label className="block text-sm font-medium text-gray-900">
      {field.label}
      {field.required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );

  if (field.type === "textarea") {
    return (
      <div>
        {labelEl}
        {field.help_text && (
          <p className="mt-1 text-xs text-gray-500">{field.help_text}</p>
        )}
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="input-field mt-1 w-full"
          required={field.required}
        />
      </div>
    );
  }

  if (field.type === "acknowledgement") {
    return (
      <label className="flex items-start gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 accent-gray-900"
          required={field.required}
        />
        <span>
          {field.label}
          {field.required && <span className="ml-1 text-red-500">*</span>}
        </span>
      </label>
    );
  }

  if (field.type === "select" && Array.isArray(field.options)) {
    return (
      <div>
        {labelEl}
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="input-field mt-1 w-full"
          required={field.required}
        >
          <option value="">Select…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "radio" && Array.isArray(field.options)) {
    return (
      <div>
        {labelEl}
        <div className="mt-1 space-y-1.5">
          {field.options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="radio"
                name={field.id}
                checked={value === o}
                onChange={() => onChange(o)}
                className="h-4 w-4 accent-gray-900"
                required={field.required}
              />
              {o}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "checkbox" && Array.isArray(field.options)) {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div>
        {labelEl}
        <div className="mt-1 space-y-1.5">
          {field.options.map((o) => {
            const checked = arr.includes(o);
            return (
              <label key={o} className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked ? arr.filter((v) => v !== o) : [...arr, o];
                    onChange(next);
                  }}
                  className="h-4 w-4 accent-gray-900"
                />
                {o}
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  // Default: text-style input. `date` uses a native date picker; the rest
  // use type=email/tel/text per FormFieldType.
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
      {labelEl}
      {field.help_text && (
        <p className="mt-1 text-xs text-gray-500">{field.help_text}</p>
      )}
      <input
        type={inputType}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="input-field mt-1 w-full"
        required={field.required}
      />
    </div>
  );
}
