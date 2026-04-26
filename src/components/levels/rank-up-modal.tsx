"use client";

import { useEffect, useState } from "react";
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

export default function RankUpModal({ rank, pendingCelebration }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pendingCelebration) {
      // Small delay so it doesn't fight with page mount
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, [pendingCelebration]);

  const dismiss = async () => {
    setOpen(false);
    try {
      await fetch("/api/members/rank-celebrated", { method: "POST" });
    } catch {
      // best-effort; the user-visible state is already closed
    }
  };

  if (!open) return null;

  // 24 confetti pieces
  const confetti = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={dismiss}
    >
      {/* confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((i) => {
          const left = (i * 4 + (i % 3) * 7) % 100;
          const delay = (i % 6) * 0.15;
          const duration = 2 + (i % 5) * 0.4;
          const colors = ["bg-yellow-400", "bg-pink-400", "bg-cyan-400", "bg-fuchsia-400", "bg-emerald-400"];
          const color = colors[i % colors.length];
          return (
            <span
              key={i}
              className={`absolute top-[-10%] h-2 w-2 ${color} rounded-sm rank-confetti`}
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
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Rank up!
        </p>
        <div
          className={`mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${RANK_GRADIENT_CLASS[rank]} text-3xl font-bold text-white shadow-lg`}
        >
          {RANK_LABEL[rank][0]}
        </div>
        <h2 className="mt-4 text-xl font-bold text-gray-900">
          You&apos;re now <span className="capitalize">{RANK_LABEL[rank]}</span>!
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Thanks for showing up. Your dedication is paying off — keep it going.
        </p>
        <button
          onClick={dismiss}
          className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Awesome
        </button>
      </div>

      <style jsx>{`
        @keyframes rank-confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
        .rank-confetti {
          animation-name: rank-confetti-fall;
          animation-timing-function: cubic-bezier(0.45, 0, 0.55, 1);
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
