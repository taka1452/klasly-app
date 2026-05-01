"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Clock, FileText } from "lucide-react";

/**
 * "Signed contracts" card on the instructor profile.
 *
 * Lists every contract envelope tied to this instructor (via
 * envelope.instructor_id), in reverse chronological order. Each row
 * shows the contract title, current status, and the signers'
 * progress so an admin can quickly tell whether everyone signed.
 *
 * Jamie feedback 2026-04-30: "Could we connect signed contracts to the
 * instructor for easy access?"
 */

type Signer = {
  id: string;
  sign_order: number;
  name: string;
  email: string;
  role_label: string | null;
  status: "pending" | "notified" | "signed" | "declined";
  signed_at: string | null;
};
type Envelope = {
  id: string;
  title: string;
  status: "draft" | "in_progress" | "completed" | "voided";
  created_at: string;
  completed_at: string | null;
  contract_envelope_signers: Signer[];
};

export default function InstructorContracts({
  instructorId,
}: {
  instructorId: string;
}) {
  const [envelopes, setEnvelopes] = useState<Envelope[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/contracts/envelopes?instructor_id=${instructorId}`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (!cancelled) setError(data.error || "Failed to load contracts");
          return;
        }
        const data = (await res.json()) as { envelopes: Envelope[] };
        if (!cancelled) setEnvelopes(data.envelopes);
      } catch {
        if (!cancelled) setError("Couldn't reach the server");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instructorId]);

  return (
    <div className="card">
      <h3 className="flex items-center gap-2 text-sm font-medium text-gray-900">
        <FileText className="h-4 w-4 text-gray-400" aria-hidden />
        Signed contracts
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        Multi-signature contracts tied to this instructor.
      </p>

      <div className="mt-3">
        {envelopes === null && !error && (
          <div className="flex items-center justify-center py-6">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        )}
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {envelopes && envelopes.length === 0 && (
          <p className="py-3 text-center text-xs text-gray-500">
            No contracts yet. Send one from <span className="font-medium">Settings → Forms</span>{" "}
            and tie it to this instructor.
          </p>
        )}
        {envelopes && envelopes.length > 0 && (
          <ol className="space-y-2">
            {envelopes.map((e) => {
              const signed = e.contract_envelope_signers.filter(
                (s) => s.status === "signed"
              ).length;
              const total = e.contract_envelope_signers.length;
              const isCompleted = e.status === "completed";
              return (
                <li key={e.id}>
                  <Link
                    href={`/contracts/envelopes/${e.id}`}
                    className="block rounded-lg border border-gray-200 px-3 py-2 transition-[transform,background-color] duration-150 ease-out hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {e.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {isCompleted
                            ? `Signed ${formatRelative(e.completed_at)}`
                            : `Started ${formatRelative(e.created_at)}`}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          isCompleted
                            ? "bg-emerald-50 text-emerald-700"
                            : e.status === "voided"
                              ? "bg-gray-100 text-gray-500"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="h-3 w-3" aria-hidden />
                        ) : (
                          <Clock className="h-3 w-3" aria-hidden />
                        )}
                        {isCompleted
                          ? "Signed"
                          : e.status === "voided"
                            ? "Voided"
                            : `${signed}/${total} signed`}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
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
