"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

type Item = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  destructive?: boolean;
  /**
   * Optional custom renderer. When provided, the menu emits `render(close)`
   * inside the menu container, replacing the default link/button. Use for
   * actions that need their own permission gate or behavior (e.g. blob
   * downloads). The renderer should call `close()` after triggering.
   */
  render?: (close: () => void) => React.ReactNode;
};

type Props = {
  items: Item[];
  ariaLabel?: string;
  className?: string;
};

/**
 * Small "⋯" overflow menu for collapsing secondary actions on mobile.
 * Use alongside a visible primary action; pass `className="sm:hidden"`
 * (or similar) when desktop already shows the same actions inline.
 */
export default function OverflowMenu({
  items,
  ariaLabel = "More actions",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{ transitionTimingFunction: "var(--ease-out-strong)" }}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-[transform,background-color,color] duration-150 hover:bg-gray-50 hover:text-gray-900 active:scale-[0.97] motion-reduce:active:scale-100"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div
          role="menu"
          className="popover-in absolute right-0 z-40 mt-1.5 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          style={{ ["--popover-origin" as string]: "top right" }}
        >
          {items.map((item, i) => {
            const staggerDelay = `${i * 30}ms`;
            if (item.render) {
              return (
                <div
                  key={item.label}
                  role="menuitem"
                  className="stagger-item"
                  style={{ animationDelay: staggerDelay }}
                >
                  {item.render(() => setOpen(false))}
                </div>
              );
            }
            const Icon = item.icon;
            const handleClick = () => {
              setOpen(false);
              item.onClick?.();
            };
            const baseClass = `stagger-item flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors duration-150 ${
              item.destructive
                ? "text-red-600 hover:bg-red-50"
                : "text-gray-700 hover:bg-gray-50"
            }`;
            const content = (
              <>
                {Icon && (
                  <Icon
                    className={`h-4 w-4 ${
                      item.destructive ? "text-red-500" : "text-gray-400"
                    }`}
                  />
                )}
                {item.label}
              </>
            );
            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                role="menuitem"
                className={baseClass}
                style={{ animationDelay: staggerDelay }}
                onClick={() => setOpen(false)}
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                onClick={handleClick}
                className={baseClass}
                style={{ animationDelay: staggerDelay }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
