"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Mail,
  Printer,
  Send,
  XCircle,
} from "lucide-react";

/**
 * Admin-side envelope detail view.
 *
 * - Lists every signer in order with status icon, name/email, and
 *   timestamps.
 * - "Resend" rotates the signer's token and re-sends the email — useful
 *   when an external signer says "I never got the email."
 * - "Void" cancels an in-progress envelope (sealed envelopes stay
 *   immutable).
 * - "Print signed copy" opens a print-friendly view that the admin can
 *   save as PDF using the browser's native print dialog (Klasly doesn't
 *   ship a server-side PDF generator yet, but Cmd-P → Save as PDF
 *   produces a clean export).
 */

type Signer = {
  id: string;
  sign_order: number;
  role_label: string | null;
  name: string;
  email: string;
  status: "pending" | "notified" | "signed" | "declined";
  signed_at: string | null;
  declined_at: string | null;
  notified_at: string | null;
};
type Envelope = {
  id: string;
  title: string;
  status: "draft" | "in_progress" | "completed" | "voided";
  created_at: string;
  completed_at: string | null;
  contract_envelope_signers: Signer[];
};

const STATUS_BADGE: Record<Envelope["status"], string> = {
  draft: "bg-gray-100 text-gray-600",
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  voided: "bg-gray-200 text-gray-600",
};

export default function EnvelopeDetailClient({
  envelopeId,
}: {
  envelopeId: string;
}) {
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/contracts/envelopes/${envelopeId}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to load envelope");
      return;
    }
    const data = (await res.json()) as { envelope: Envelope };
    setEnvelope(data.envelope);
    setError(null);
  }, [envelopeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function resend(signerId: string) {
    if (!envelope) return;
    setBusy("resend-" + signerId);
    const res = await fetch(`/api/contracts/envelopes/${envelopeId}/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signer_id: signerId }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setToast(data.error || "Resend failed");
      return;
    }
    setToast("Reminder sent. Old link is now invalid.");
    await refresh();
  }

  async function voidEnvelope() {
    if (!envelope) return;
    if (!confirm("Void this envelope? Signers who haven't signed yet will get an invalid link.")) return;
    setBusy("void");
    const res = await fetch(`/api/contracts/envelopes/${envelopeId}/void`, {
      method: "POST",
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setToast(data.error || "Void failed");
      return;
    }
    setToast("Envelope voided.");
    await refresh();
  }

  if (error) {
    return (
      <div className="card mt-6 max-w-xl">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }
  if (!envelope) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spin-fast h-6 w-6 rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const signers = envelope.contract_envelope_signers.sort(
    (a, b) => a.sign_order - b.sign_order
  );
  const isCompleted = envelope.status === "completed";
  const canManage = envelope.status === "in_progress";

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/settings/forms"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to forms
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {envelope.title}
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Started {formatRelative(envelope.created_at)}
              {envelope.completed_at &&
                ` · Completed ${formatRelative(envelope.completed_at)}`}
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[envelope.status]}`}
          >
            {envelope.status === "completed" ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            ) : envelope.status === "voided" ? (
              <XCircle className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Clock className="h-3.5 w-3.5" aria-hidden />
            )}
            {envelope.status.replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="card max-w-2xl">
        <h2 className="text-sm font-semibold text-gray-900">Signers</h2>
        <p className="mt-1 text-xs text-gray-500">
          Each signer is emailed in order. Earlier signers must complete
          before later ones receive their link.
        </p>

        <ol className="mt-4 space-y-2">
          {signers.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-gray-200 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {s.sign_order}. {s.name}
                    {s.role_label && (
                      <span className="ml-2 text-[11px] font-normal text-gray-500">
                        {s.role_label}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-500">{s.email}</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {s.status === "signed" && s.signed_at
                      ? `Signed ${formatRelative(s.signed_at)}`
                      : s.status === "declined" && s.declined_at
                        ? `Declined ${formatRelative(s.declined_at)}`
                        : s.status === "notified" && s.notified_at
                          ? `Email sent ${formatRelative(s.notified_at)}`
                          : "Waiting for previous signer"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SignerStatusPill status={s.status} />
                  {canManage &&
                    s.status !== "signed" &&
                    s.status !== "declined" && (
                      <button
                        type="button"
                        onClick={() => resend(s.id)}
                        disabled={busy === "resend-" + s.id}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 transition-[transform,background-color] duration-150 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
                      >
                        <Mail className="h-3 w-3" aria-hidden />
                        <span className="label-swap" data-pending={busy === "resend-" + s.id}>
                          {busy === "resend-" + s.id ? "Sending…" : "Resend"}
                        </span>
                      </button>
                    )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isCompleted && (
              <Link
                href={`/contracts/envelopes/${envelope.id}/print`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-[transform,background-color] duration-150 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 active:scale-[0.97]"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden />
                Print signed copy
              </Link>
            )}
          </div>
          {canManage && (
            <button
              type="button"
              onClick={voidEnvelope}
              disabled={busy === "void"}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-[transform,background-color] duration-150 ease-out hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden />
              <span className="label-swap" data-pending={busy === "void"}>
                {busy === "void" ? "Voiding…" : "Void envelope"}
              </span>
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="toast-enter-bottom fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-3 text-xs text-gray-300 transition-colors duration-150 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function SignerStatusPill({ status }: { status: Signer["status"] }) {
  if (status === "signed")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        Signed
      </span>
    );
  if (status === "declined")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
        <XCircle className="h-3 w-3" aria-hidden />
        Declined
      </span>
    );
  if (status === "notified")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
        <Send className="h-3 w-3" aria-hidden />
        Awaiting
      </span>
    );
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
      <Clock className="h-3 w-3" aria-hidden />
      Queued
    </span>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return new Date(iso).toLocaleDateString();
}
