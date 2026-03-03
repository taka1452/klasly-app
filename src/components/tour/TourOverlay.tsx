"use client";

import { useTour, type TourState } from "@/hooks/useTour";

type TourOverlayProps = {
  role: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  userId: string | undefined;
  forceStart?: boolean;
};

export default function TourOverlay({
  role,
  onboardingCompleted,
  onboardingStep,
  userId,
  forceStart = false,
}: TourOverlayProps) {
  const isEnabled =
    (role === "owner" || role === "instructor") &&
    (!onboardingCompleted || forceStart);
  const { state, nextStep, prevStep, skipTour, finishTour, restartTour } =
    useTour(role, isEnabled, userId, forceStart ? 0 : onboardingStep, !forceStart);

  if (!state.isActive || state.steps.length === 0) return null;

  const step = state.steps[state.currentStep];
  if (!step) return null;

  const isLastStep = state.currentStep >= state.steps.length - 1;
  const stepLabel = `${state.currentStep + 1} / ${state.steps.length}`;

  return (
    <div
      className="fixed inset-0 z-[9998] animate-[fadeIn_0.2s_ease-out]"
      aria-modal="true"
      role="dialog"
      aria-label="Product tour"
    >
      {/* Dark overlay with cutout - click outside highlight to skip */}
      {state.targetRect ? (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={skipTour}
            onKeyDown={(e) => e.key === "Escape" && skipTour()}
            className="absolute inset-0 bg-black/65 cursor-default"
            style={{
              clipPath: getCutoutPath(state.targetRect),
            }}
            aria-label="Click to skip tour"
          />
          <div
            className="pointer-events-none absolute border-2 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all duration-200"
            style={{
              left: state.targetRect.left - 4,
              top: state.targetRect.top - 4,
              width: state.targetRect.width + 8,
              height: state.targetRect.height + 8,
              borderRadius: "12px",
            }}
          />
        </>
      ) : (
        <button
          type="button"
          className="absolute inset-0 bg-black/60"
          onClick={skipTour}
          aria-label="Skip tour"
        />
      )}

      {/* Tooltip card */}
      {state.showTooltip && (
        <div
          className="absolute z-[10000] min-w-[280px] max-w-[360px] animate-[fadeIn_0.2s_ease-out]"
          style={getTooltipPosition(state)}
        >
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
              {stepLabel}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
            <p className="mt-2 text-sm text-gray-600">{step.description}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {state.currentStep > 0 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={nextStep}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                {isLastStep ? "Finish" : "Next"}
              </button>
              <button
                type="button"
                onClick={skipTour}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
              >
                Skip tour
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getCutoutPath(rect: DOMRect): string {
  const pad = 4;
  const x1 = Math.max(0, rect.left - pad);
  const y1 = Math.max(0, rect.top - pad);
  const x2 = Math.min(typeof window !== "undefined" ? window.innerWidth : 1920, rect.right + pad);
  const y2 = Math.min(typeof window !== "undefined" ? window.innerHeight : 1080, rect.bottom + pad);
  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x1}px ${y1}px, ${x2}px ${y1}px, ${x2}px ${y2}px, ${x1}px ${y2}px, ${x1}px ${y1}px)`;
}

function getTooltipPosition(state: TourState): React.CSSProperties {
  const step = state.steps[state.currentStep];
  if (!step) return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };

  const padding = 16;
  const tooltipHeight = 180;
  const tooltipWidth = 320;

  if (!state.targetRect) {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  const rect = state.targetRect;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 800;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 600;

  let left = rect.left + rect.width / 2 - tooltipWidth / 2;
  let top = rect.bottom + padding;

  if (top + tooltipHeight > viewportHeight - 20) {
    top = rect.top - tooltipHeight - padding;
  }
  if (left < 20) left = 20;
  if (left + tooltipWidth > viewportWidth - 20) {
    left = viewportWidth - tooltipWidth - 20;
  }
  if (top < 20) top = 20;

  return {
    left: `${left}px`,
    top: `${top}px`,
  };
}

export { TourOverlay };
