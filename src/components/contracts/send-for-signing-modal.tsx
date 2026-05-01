"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from "lucide-react";

/**
 * Owner-side modal for kicking off a multi-signer contract envelope.
 *
 * UX:
 * - Title (defaults to the form name).
 * - Optional instructor link — when set, the completed envelope shows
 *   on the instructor's profile.
 * - Ordered signer list. The first signer is emailed immediately; the
 *   rest are queued and only emailed when the previous signer signs.
 * - Each signer has name, email, and an optional role label
 *   ("Studio owner", "Witness", etc.) shown to the receiver in the
 *   email and on the signing page.
 *
 * Drag-to-reorder is intentionally *not* shipped here — instead the
 * up/down buttons next to each row let the admin pick the order. The
 * up/down model is more accessible (keyboard-friendly without
 * additional ARIA work) and behaves predictably on touch.
 *
 * Jamie feedback 2026-04-30: "Is there an option or ability to collect
 * multiple signatures in a specific order on contracts through Klasly,
 * similar to how Jotform works?"
 */

type FormShape = { id: string; name: string };

type Signer = {
  name: string;
  email: string;
  role_label: string;
};

type Instructor = { id: string; name: string };

export default function SendForSigningModal({
  form,
  onClose,
}: {
  form: FormShape;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(form.name);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [instructorId, setInstructorId] = useState<string>("");
  const [signers, setSigners] = useState<Signer[]>([
    { name: "", email: "", role_label: "" },
    { name: "", email: "", role_label: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/instructors");
        if (!res.ok) return;
        const data = (await res.json()) as Instructor[];
        if (!cancelled) setInstructors(data);
      } catch {
        // optional list — modal still works without it
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateSigner(idx: number, patch: Partial<Signer>) {
    setSigners((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeSigner(idx: number) {
    setSigners((rows) => rows.filter((_, i) => i !== idx));
  }
  function addSigner() {
    if (signers.length >= 10) return;
    setSigners((rows) => [...rows, { name: "", email: "", role_label: "" }]);
  }
  function moveSigner(idx: number, delta: -1 | 1) {
    setSigners((rows) => {
      const next = [...rows];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return rows;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = signers
      .map((s) => ({
        name: s.name.trim(),
        email: s.email.trim().toLowerCase(),
        role_label: s.role_label.trim(),
      }))
      .filter((s) => s.name && s.email);
    if (cleaned.length === 0) {
      setError("Add at least one signer.");
      return;
    }
    for (const s of cleaned) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) {
        setError(`Invalid email for ${s.name}.`);
        return;
      }
    }

    setSubmitting(true);
    const res = await fetch("/api/contracts/envelopes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        form_id: form.id,
        title: title.trim() || form.name,
        instructor_id: instructorId || null,
        signers: cleaned,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to send for signing");
      return;
    }
    setDone(true);
  }

  return (
    <div
      className="modal-backdrop-enter fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="modal-dialog-enter w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Send for signing
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {done
                ? "Envelope sent. The first signer just got an email."
                : "Pick the signers in the order they should sign. Each one gets emailed only after the previous signer completes."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-m-2 rounded-md p-2 text-gray-400 transition-[color,transform] duration-150 ease-out hover:text-gray-600 active:scale-[0.97]"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {done ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              Klasly emailed the first signer. They&rsquo;ll see this contract
              in their inbox at the address you provided. You can track
              progress on the contract&rsquo;s Submissions list.
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={form.name}
                className="input-field mt-1 w-full"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                What signers will see in their email subject line.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Tie to an instructor (optional)
              </label>
              <select
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                className="input-field mt-1 w-full"
              >
                <option value="">— No instructor link —</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-500">
                When set, the signed contract appears on this instructor&apos;s
                profile for easy access later.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Signers (in order)
                </label>
                <button
                  type="button"
                  onClick={addSigner}
                  disabled={signers.length >= 10}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 transition-[transform,background-color] duration-150 ease-out hover:bg-gray-50 disabled:opacity-50 active:scale-[0.97]"
                >
                  <Plus className="h-3 w-3" aria-hidden />
                  Add signer
                </button>
              </div>

              <div className="space-y-2">
                {signers.map((s, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-gray-200 bg-gray-50/60 p-2.5"
                  >
                    <div className="mb-2 flex items-center justify-between text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-gray-700">
                        <GripVertical className="h-3 w-3" aria-hidden />
                        Signer {idx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveSigner(idx, -1)}
                          disabled={idx === 0}
                          className="inline-flex items-center justify-center rounded border border-gray-200 bg-white p-1 text-gray-700 transition-[transform,background-color] duration-150 ease-out hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-3 w-3" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSigner(idx, 1)}
                          disabled={idx === signers.length - 1}
                          className="inline-flex items-center justify-center rounded border border-gray-200 bg-white p-1 text-gray-700 transition-[transform,background-color] duration-150 ease-out hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-3 w-3" aria-hidden />
                        </button>
                        {signers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSigner(idx)}
                            className="rounded border border-red-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-red-600 transition-[transform,background-color] duration-150 ease-out hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/20 active:scale-[0.97]"
                            aria-label="Remove signer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => updateSigner(idx, { name: e.target.value })}
                        placeholder="Name"
                        className="input-field"
                        required
                      />
                      <input
                        type="email"
                        value={s.email}
                        onChange={(e) => updateSigner(idx, { email: e.target.value })}
                        placeholder="email@example.com"
                        className="input-field"
                        required
                      />
                    </div>
                    <input
                      type="text"
                      value={s.role_label}
                      onChange={(e) =>
                        updateSigner(idx, { role_label: e.target.value })
                      }
                      placeholder="Role (optional, e.g. Studio owner)"
                      className="input-field mt-2"
                    />
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
              >
                <span className="label-swap" data-pending={submitting}>
                  {submitting ? "Sending…" : "Send to first signer"}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
