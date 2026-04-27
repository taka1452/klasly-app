"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Window event name. Other UI dispatches this to open the palette. */
export const COMMAND_PALETTE_OPEN_EVENT = "klasly:open-command-palette";

type Role = "owner" | "manager" | "instructor" | "member";

type NavCommand = {
  label: string;
  href: string;
  group: string;
  roles: Role[];
  keywords?: string[];
};

/**
 * Curated list of palette destinations. Not a mirror of the full sidebar —
 * the goal is "type 2 letters and jump", not "browse a tree". Add a row
 * here when a new top-level page lands.
 */
const COMMANDS: NavCommand[] = [
  { label: "Dashboard", href: "/dashboard", group: "Overview", roles: ["owner", "manager"] },

  { label: "Members", href: "/members", group: "People", roles: ["owner", "manager"], keywords: ["customers", "students"] },
  { label: "Add member", href: "/members/new", group: "People", roles: ["owner", "manager"], keywords: ["new", "invite"] },
  { label: "Instructors", href: "/instructors", group: "People", roles: ["owner", "manager"] },
  { label: "Managers", href: "/managers", group: "People", roles: ["owner"], keywords: ["staff", "team"] },

  { label: "Calendar", href: "/calendar", group: "Schedule", roles: ["owner", "manager"], keywords: ["timetable"] },
  { label: "Classes", href: "/classes", group: "Schedule", roles: ["owner", "manager"] },
  { label: "Rooms", href: "/rooms", group: "Schedule", roles: ["owner", "manager"] },
  { label: "Events", href: "/events", group: "Schedule", roles: ["owner", "manager"], keywords: ["retreat", "workshop"] },
  { label: "Appointments", href: "/appointments", group: "Schedule", roles: ["owner", "manager"] },
  { label: "Bookings", href: "/bookings", group: "Schedule", roles: ["owner", "manager"], keywords: ["reservations"] },

  { label: "Payments", href: "/payments", group: "Money", roles: ["owner", "manager"], keywords: ["revenue", "transactions"] },
  { label: "Passes", href: "/passes", group: "Money", roles: ["owner", "manager"], keywords: ["membership", "credits"] },

  { label: "Messages", href: "/messages", group: "Communication", roles: ["owner", "manager"], keywords: ["chat", "dm"] },
  { label: "Announcements", href: "/studio-announcements", group: "Communication", roles: ["owner", "manager"], keywords: ["broadcast"] },
  { label: "Campaigns", href: "/campaigns", group: "Communication", roles: ["owner", "manager"], keywords: ["email"] },
  { label: "Reviews", href: "/reviews", group: "Communication", roles: ["owner", "manager"], keywords: ["feedback", "ratings"] },

  { label: "Analytics", href: "/analytics", group: "Analyze", roles: ["owner"], keywords: ["reports", "metrics"] },
  { label: "Settings", href: "/settings", group: "Settings", roles: ["owner", "manager"] },
  { label: "Billing", href: "/settings/billing", group: "Settings", roles: ["owner"], keywords: ["subscription", "plan"] },
  { label: "Stripe Connect", href: "/settings/connect", group: "Settings", roles: ["owner"], keywords: ["payouts"] },
  { label: "Pricing", href: "/settings/pricing", group: "Settings", roles: ["owner"], keywords: ["products", "plans"] },
  { label: "Waiver", href: "/settings/waiver", group: "Settings", roles: ["owner", "manager"] },
  { label: "Widget", href: "/settings/widget", group: "Settings", roles: ["owner"], keywords: ["embed"] },
  { label: "Help center", href: "/help", group: "Settings", roles: ["owner", "manager", "instructor", "member"], keywords: ["docs", "support"] },

  { label: "My classes", href: "/my-classes", group: "Teaching", roles: ["instructor"] },
  { label: "My earnings", href: "/my-earnings", group: "Teaching", roles: ["instructor"] },
];

type Props = {
  /** Viewer's role — used to filter the command list. */
  role: string;
};

function fuzzyMatch(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase().trim();
  if (h.includes(n)) return true;
  // Subsequence match: "mbs" matches "members" (m-e-m-b-e-r-S → m,b,s)
  let i = 0;
  for (const ch of h) {
    if (ch === n[i]) i++;
    if (i === n.length) return true;
  }
  return false;
}

/**
 * Lightweight command palette. Hand-rolled (no cmdk dep) so SSR/hydration
 * is bullet-proof: the entire UI is gated behind `open`, which only flips
 * after a client-side keypress or window event.
 */
export default function CommandPalette({ role }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Open / close keyboard + custom event
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isToggle = (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
      if (isToggle) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const openHandler = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, openHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, openHandler);
    };
  }, []);

  // Reset state every time it opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // focus on next frame so it works reliably in dev/HMR
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const matches = useMemo(() => {
    const filtered = COMMANDS.filter((c) => c.roles.includes(role as Role)).filter((c) => {
      if (!query.trim()) return true;
      const haystack = `${c.label} ${c.group} ${c.keywords?.join(" ") ?? ""}`;
      return fuzzyMatch(haystack, query);
    });
    return filtered;
  }, [role, query]);

  // Group preserving original order
  const grouped = useMemo(() => {
    const map = new Map<string, NavCommand[]>();
    for (const c of matches) {
      const list = map.get(c.group) ?? [];
      list.push(c);
      map.set(c.group, list);
    }
    return Array.from(map.entries());
  }, [matches]);

  const onSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  // Reset active when matches change so we never end up off-list
  useEffect(() => {
    if (active >= matches.length) setActive(0);
  }, [active, matches.length]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = matches[active];
      if (target) onSelect(target.href);
    }
  };

  // Scroll active item into view as it changes
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-index="${active}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  let runningIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-gray-900/40 px-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search pages"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 px-4">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="h-12 w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
            aria-label="Search pages"
            aria-controls="command-palette-list"
            aria-activedescendant={
              matches[active] ? `cmd-item-${active}` : undefined
            }
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          className="max-h-[60vh] overflow-y-auto px-2 py-2"
        >
          {matches.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-500">
              Nothing matches that.
            </p>
          ) : (
            grouped.map(([group, list]) => (
              <div key={group} className="mb-1 last:mb-0">
                <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  {group}
                </div>
                {list.map((cmd) => {
                  const idx = runningIndex++;
                  const isActive = idx === active;
                  return (
                    <button
                      key={cmd.href}
                      id={`cmd-item-${idx}`}
                      data-cmd-index={idx}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => onSelect(cmd.href)}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-brand-50 text-brand-700"
                          : "text-gray-800 hover:bg-gray-50"
                      }`}
                    >
                      <span>{cmd.label}</span>
                      <span className="text-[11px] text-gray-400">{cmd.href}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-[11px] text-gray-400">
          <span>
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans">↑↓</kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans">↵</kbd>{" "}
            open ·{" "}
            <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-sans">esc</kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  );
}
