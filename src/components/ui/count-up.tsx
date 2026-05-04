"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  /** Animation duration in ms (default 600) */
  duration?: number;
  /** Custom formatter — receives the current animated number. */
  format: (n: number) => string;
  className?: string;
};

/**
 * Smoothly animates a numeric value from its previous render to the new
 * value. Skips the animation entirely when prefers-reduced-motion is set
 * and on the initial mount with a zero baseline (renders the final value
 * with no flicker on subsequent re-renders).
 */
export function CountUp({ value, duration = 600, format, className }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (typeof window === "undefined") {
      setDisplay(value);
      return;
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduced) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const from = fromRef.current;
    const delta = value - from;
    if (delta === 0) return;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + delta * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
