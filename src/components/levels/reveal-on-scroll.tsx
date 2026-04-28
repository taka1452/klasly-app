"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Delay (ms) before the reveal animation starts after intersecting */
  delay?: number;
};

/**
 * Fades + lifts its child once when it scrolls into view (50% visible).
 * Designed for /wrapped/[year] sections — a "rare" interaction where
 * delight is appropriate. Honors prefers-reduced-motion via globals.css.
 */
export default function RevealOnScroll({ children, className = "", delay = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // SSR/old browser fallback — show immediately
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            if (delay > 0) {
              setTimeout(() => setRevealed(true), delay);
            } else {
              setRevealed(true);
            }
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.4, rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <div ref={ref} data-revealed={revealed} className={`wrapped-section ${className}`}>
      {children}
    </div>
  );
}
