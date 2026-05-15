"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  id: string;
  title: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function CollapsibleSection({
  id,
  title,
  defaultOpen = true,
  actions,
  className,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(`dashboard-collapse:${id}`);
    if (stored === "closed") setOpen(false);
    else if (stored === "open") setOpen(true);
    setMounted(true);
  }, [id]);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(
          `dashboard-collapse:${id}`,
          next ? "open" : "closed",
        );
      } catch {
        // localStorage unavailable — no-op
      }
      return next;
    });
  }

  return (
    <section className={className ?? "mt-10 md:mt-12"}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={`section-${id}`}
          className="group flex flex-1 items-center gap-2 text-left"
        >
          <svg
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-hover:text-gray-600 ${
              open ? "rotate-90" : ""
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900">
            {title}
          </h2>
        </button>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div
        id={`section-${id}`}
        ref={contentRef}
        hidden={mounted && !open}
        aria-hidden={mounted && !open}
      >
        {children}
      </div>
    </section>
  );
}
