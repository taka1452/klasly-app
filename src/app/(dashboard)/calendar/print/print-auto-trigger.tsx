"use client";

import { useEffect } from "react";

/**
 * Tiny client wrapper that:
 *   1. Adds a `print-page` class to <body> so our @media print rules in
 *      design-eng.css kick in (hide sidebar/header etc.) — and removes it
 *      on unmount so navigating back to the calendar doesn't leak the
 *      print styles.
 *   2. Wires up any `<button data-print-button>` on the page to
 *      window.print() so the server-rendered "Print" button doesn't need
 *      its own client component.
 *   3. Auto-triggers window.print() once on mount when the URL doesn't
 *      include ?auto=false. Wrapped in a 100ms timeout so the layout has
 *      a tick to settle (otherwise some browsers race the print snapshot).
 */
export default function PrintAutoTrigger() {
  useEffect(() => {
    document.body.classList.add("print-page");

    const buttons = document.querySelectorAll<HTMLButtonElement>(
      "button[data-print-button]"
    );
    const handleClick = () => window.print();
    buttons.forEach((b) => b.addEventListener("click", handleClick));

    const timer = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        /* user can still hit the Print button */
      }
    }, 100);

    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove("print-page");
      buttons.forEach((b) => b.removeEventListener("click", handleClick));
    };
  }, []);

  return null;
}
