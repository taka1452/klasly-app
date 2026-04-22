"use client";

import Link from "next/link";
import { getSuccessCtaForRole } from "@/lib/onboardingSteps";

type TourSuccessModalProps = {
  role: string;
  onClose: () => void;
};

export default function TourSuccessModal({
  role,
  onClose,
}: TourSuccessModalProps) {
  const cta = getSuccessCtaForRole(role);

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 p-4 animate-[fadeIn_0.2s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-success-title"
    >
      <div className="relative max-w-md w-full rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl animate-[zoomIn_0.3s_ease-out]">
        {/* Lightweight CSS confetti */}
        <div className="confetti-container pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          {[
            { left: "15%", delay: 0 },
            { left: "25%", delay: 0.08 },
            { left: "35%", delay: 0.04 },
            { left: "45%", delay: 0.12 },
            { left: "55%", delay: 0.06 },
            { left: "65%", delay: 0.1 },
            { left: "75%", delay: 0.02 },
            { left: "85%", delay: 0.14 },
            { left: "20%", delay: 0.05 },
            { left: "50%", delay: 0.03 },
            { left: "80%", delay: 0.07 },
            { left: "40%", delay: 0.09 },
          ].map((pos, i) => (
            <div
              key={i}
              className="confetti-piece absolute"
              style={{
                left: pos.left,
                animationDelay: `${pos.delay}s`,
                backgroundColor: ["#6366f1", "#10b981", "#f59e0b", "#ec4899"][i % 4],
              }}
            />
          ))}
        </div>

        <div className="relative text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-8 w-8 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <h2
            id="tour-success-title"
            className="text-xl font-semibold text-gray-900"
          >
            You&apos;re all set!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            You now know your way around. Ready to get started?
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {cta.href ? (
              <Link
                href={cta.href}
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                {cta.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700"
              >
                {cta.label}
              </button>
            )}
            {cta.href && (
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
