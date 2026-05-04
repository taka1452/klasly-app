"use client";

import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

type State = "idle" | "loading" | "success";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  /** Async handler. Loading and success states are managed automatically. */
  onAction: () => Promise<unknown> | unknown;
  /** Resting label. */
  children: ReactNode;
  /** Override label while the action is pending. */
  loadingLabel?: ReactNode;
  /** Override label during the brief success pop. */
  successLabel?: ReactNode;
  /** How long the success state stays before resetting (default 700ms). */
  successDurationMs?: number;
  /** Skip the success ✓ animation entirely. */
  noSuccessPop?: boolean;
};

/**
 * Button that orchestrates loading → ✓ success → idle for an async
 * action. Use for submit/confirm-style buttons where seeing the ✓
 * lands the "it worked" feeling. The check icon uses the
 * `.button-check-pop` keyframe (and is hidden under
 * `prefers-reduced-motion`).
 */
export const ActionButton = forwardRef<HTMLButtonElement, Props>(
  function ActionButton(
    {
      onAction,
      children,
      loadingLabel = "Saving…",
      successLabel = "Done",
      successDurationMs = 700,
      noSuccessPop,
      disabled,
      className,
      ...rest
    },
    ref
  ) {
    const [state, setState] = useState<State>("idle");

    async function handleClick() {
      if (state !== "idle") return;
      setState("loading");
      try {
        await onAction();
        if (noSuccessPop) {
          setState("idle");
          return;
        }
        setState("success");
        window.setTimeout(() => setState("idle"), successDurationMs);
      } catch {
        setState("idle");
      }
    }

    let label: ReactNode = children;
    if (state === "loading") label = loadingLabel;
    if (state === "success")
      label = (
        <span className="inline-flex items-center justify-center gap-1.5">
          <CheckIcon />
          {successLabel}
        </span>
      );

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        disabled={disabled || state !== "idle"}
        aria-busy={state === "loading" || undefined}
        aria-live="polite"
        className={className}
        {...rest}
      >
        {label}
      </button>
    );
  }
);

/**
 * Inline ✓ + label fragment with the success-pop animation. Use this
 * inside an existing form-managed button (where a controlled async
 * handler doesn't fit) once your handler resolves successfully.
 */
export function ActionSuccessLabel({
  label = "Done",
}: {
  label?: ReactNode;
}) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <CheckIcon />
      {label}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg
      className="button-check-pop h-4 w-4"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.704 5.296a1 1 0 010 1.408l-7.999 8a1 1 0 01-1.408 0l-3.999-4a1 1 0 011.408-1.408L8 12.59l7.295-7.294a1 1 0 011.41 0z"
      />
    </svg>
  );
}
