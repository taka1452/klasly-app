"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

/**
 * Print layout for a fully signed envelope.
 *
 * Visually styled like a contract letter rather than a Klasly dashboard
 * page so that "Save as PDF" produces something a lawyer wouldn't laugh
 * at. Header = studio + envelope title. Body = the form's intro_text +
 * each field's prompt followed by every signer's response. Footer =
 * each signer's typed-name signature with date + IP.
 */

type Field = {
  id: string;
  label: string;
  type: string;
  options?: string[];
};
type Signer = {
  id: string;
  sign_order: number;
  role_label: string | null;
  name: string;
  email: string;
  status: string;
  signed_at: string | null;
  signature_data: string | null;
  ip_address: string | null;
};
type LoadedData = {
  envelope: {
    id: string;
    title: string;
    status: string;
    created_at: string;
    completed_at: string | null;
  };
  studio: { name: string };
  form: { name?: string; intro_text?: string | null; fields: Field[] };
  signers: Signer[];
};

export default function EnvelopePrintClient({
  envelopeId,
}: {
  envelopeId: string;
}) {
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/contracts/envelopes/${envelopeId}/printable`
        );
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          if (!cancelled) setError(payload.error || "Couldn't load envelope");
          return;
        }
        const json = (await res.json()) as LoadedData;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Couldn't reach the server");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [envelopeId]);

  if (error)
    return (
      <div className="mx-auto max-w-md py-16 text-center text-sm text-red-600">
        {error}
      </div>
    );
  if (!data)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="spin-fast h-6 w-6 rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );

  return (
    <div className="contract-print mx-auto max-w-3xl px-8 py-10 print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-[transform,background-color] duration-150 ease-out hover:bg-gray-50 active:scale-[0.97]"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden />
          Print or save as PDF
        </button>
        <span className="text-[11px] text-gray-400">
          Tip: choose "Save as PDF" in the print dialog destination.
        </span>
      </div>

      <header className="mb-6 border-b border-gray-300 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">
          {data.studio.name}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {data.envelope.title}
        </h1>
        <p className="mt-2 text-xs text-gray-500">
          Issued {new Date(data.envelope.created_at).toLocaleDateString()} ·
          Completed{" "}
          {data.envelope.completed_at
            ? new Date(data.envelope.completed_at).toLocaleDateString()
            : "—"}
        </p>
      </header>

      {data.form.intro_text && (
        <section className="mb-6 whitespace-pre-line text-[14px] leading-relaxed text-gray-800">
          {data.form.intro_text}
        </section>
      )}

      {data.form.fields.length > 0 && data.signers.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
            Responses
          </h2>
          <dl className="space-y-3 text-[13px]">
            {data.form.fields.map((f) => (
              <div key={f.id}>
                <dt className="font-medium text-gray-700">{f.label}</dt>
                <dd className="mt-0.5 text-gray-900">
                  {/* Print combines all signer responses for the same field
                      with a divider between them — useful for contracts
                      where each signer fills their own copy of the same
                      questionnaire. */}
                  <em className="text-gray-400">(submitted by signers below)</em>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mb-8 space-y-6 border-t border-gray-300 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
          Signatures
        </h2>
        {data.signers.map((s) => (
          <div key={s.id} className="break-inside-avoid">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">
              Signer {s.sign_order}
              {s.role_label ? ` · ${s.role_label}` : ""}
            </p>
            <p className="mt-2 font-serif text-2xl italic text-gray-900">
              {s.signature_data || "—"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-gray-500">
              <span>{s.name}</span>
              <span>{s.email}</span>
              <span>
                {s.signed_at
                  ? `Signed ${new Date(s.signed_at).toLocaleString()}`
                  : s.status === "declined"
                    ? "Declined"
                    : "Not yet signed"}
              </span>
              {s.ip_address && <span>IP {s.ip_address}</span>}
            </div>
          </div>
        ))}
      </section>

      <footer className="border-t border-gray-300 pt-4 text-[11px] text-gray-500">
        Envelope ID: {data.envelope.id}
      </footer>

      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
          }
          .contract-print {
            color: #000;
          }
          aside,
          nav,
          header[data-app-shell] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
