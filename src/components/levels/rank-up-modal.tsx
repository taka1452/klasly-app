"use client";

import { useEffect, useRef, useState } from "react";
import {
  RANK_LABEL,
  RANK_GRADIENT_CLASS,
  type Rank,
} from "@/lib/rank";

type Props = {
  rank: Rank;
  // Whether the user has already seen the celebration for this rank.
  // If false, show modal once and POST to mark as celebrated.
  pendingCelebration: boolean;
};

const CONFETTI_COLORS = [
  "bg-yellow-400",
  "bg-pink-400",
  "bg-cyan-400",
  "bg-fuchsia-400",
  "bg-emerald-400",
];

export default function RankUpModal({ rank, pendingCelebration }: Props) {
  const [open, setOpen] = useState(false);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!pendingCelebration) return;
    // Small delay so it doesn't fight with page mount.
    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
  }, [pendingCelebration]);

  // Focus the primary action when the dialog opens.
  useEffect(() => {
    if (open) dismissRef.current?.focus();
  }, [open]);

  const dismiss = async () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setOpen(false);
    try {
      await fetch("/api/members/rank-celebrated", { method: "POST" });
    } catch {
      // best-effort; the user-visible state is already closed
    }
  };

  // Escape to dismiss.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const confetti = Array.from({ length: 18 }, (_, i) => i);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rank-up-title"
      className="rank-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={dismiss}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {confetti.map((i) => {
          const left = (i * 4 + (i % 3) * 7) % 100;
          const delay = (i % 6) * 0.15;
          const duration = 2 + (i % 5) * 0.4;
          const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
          return (
            <span
              key={i}
              className={`rank-confetti absolute -top-2 h-2 w-2 rounded-sm ${color}`}
              style={{
                left: `${left}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
              }}
            />
          );
        })}
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        className="rank-dialog-in relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Rank up
        </p>
        <div
          className={`mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${RANK_GRADIENT_CLASS[rank]} text-3xl font-bold text-white shadow-lg`}
          aria-hidden="true"
        >
          {RANK_LABEL[rank][0]}
        </div>
        <h2 id="rank-up-title" className="mt-4 text-xl font-bold text-gray-900">
          You&apos;re now {RANK_LABEL[rank]}
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Thanks for showing up. Your dedication is paying off — keep it going.
        </p>
        <button
          ref={dismissRef}
          type="button"
          onClick={dismiss}
          className="btn-primary mt-5 w-full"
        >
          Awesome
        </button>
      </div>
    </div>
  );
}
