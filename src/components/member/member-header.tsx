"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LanguageSelector from "@/components/i18n/language-selector";
import RankRing from "@/components/levels/rank-ring";
import StreakIndicator from "@/components/levels/streak-indicator";
import { RANK_LABEL, type Rank } from "@/lib/rank";

type Props = {
  userName: string;
  userEmail: string;
  rank?: Rank | null;
  lifetimeClasses?: number | null;
  streakWeeks?: number;
  streakAtRisk?: boolean;
  onMenuClick?: () => void;
};

export default function MemberHeader({
  userName,
  userEmail,
  rank,
  lifetimeClasses,
  streakWeeks = 0,
  streakAtRisk = false,
  onMenuClick,
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
      <div className="flex items-center gap-3">
        <Link href="/schedule" className="text-xl font-bold text-brand-700">
          Klasly
        </Link>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
      {streakWeeks > 0 && (
        <StreakIndicator weeks={streakWeeks} atRisk={streakAtRisk} variant="compact" />
      )}
      <LanguageSelector />
      <Link
        href="/help"
        target="_blank"
        className="hidden h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition-[transform,background-color,color] duration-150 ease-out hover:bg-gray-100 hover:text-gray-600 active:scale-[0.97] md:flex"
        title="Help"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18.75h.007v.008H12v-.008z" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      </Link>
      <div className="relative hidden md:block" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-700 transition-[transform,background-color] duration-150 ease-out hover:bg-gray-100 active:scale-[0.97]"
        >
          {rank && (
            <RankRing
              rank={rank}
              initial={(userName?.[0] || "?").toUpperCase()}
              size="sm"
            />
          )}
          <span className="hidden sm:inline">{userName}</span>
          <svg
            className="h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>
        {menuOpen && (
          <div className="popover-in absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg" style={{ ["--popover-origin" as string]: "top right" }}>
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="text-sm font-medium text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500">{process.env.NEXT_PUBLIC_DEMO_DISPLAY_EMAIL || userEmail}</p>
              {rank && (
                <p className="mt-1 text-xs text-gray-700">
                  <span className="font-semibold">{RANK_LABEL[rank]}</span>
                  {typeof lifetimeClasses === "number" && (
                    <span className="text-gray-400"> · {lifetimeClasses} classes</span>
                  )}
                </p>
              )}
            </div>
            <a
              href="/account"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 transition-colors duration-150 hover:bg-gray-50"
            >
              Account settings
            </a>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition-colors duration-150 hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 transition-[transform,background-color] duration-150 ease-out hover:bg-gray-100 active:scale-[0.97] md:hidden"
          aria-label="Open menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </button>
      )}
      </div>
    </header>
  );
}
