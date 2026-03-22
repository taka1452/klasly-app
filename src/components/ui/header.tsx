"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PAGE_NAMES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/members": "Members",
  "/instructors": "Instructors",
  "/calendar": "Schedule",
  "/classes": "Classes",
  "/bookings": "Bookings",
  "/rooms": "Rooms",
  "/events": "Events",
  "/payments": "Payments",
  "/passes": "Passes",
  "/messages": "Messages",
  "/studio-announcements": "Announcements",
  "/managers": "Managers",
  "/analytics": "Analytics",
  "/my-classes": "My Classes",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (PAGE_NAMES[pathname]) return PAGE_NAMES[pathname];
  if (pathname.startsWith("/members/")) return "Member";
  if (pathname.startsWith("/instructors/")) return "Instructor";
  if (pathname.startsWith("/calendar/")) return "Schedule";
  if (pathname.startsWith("/classes/")) return "Class";
  if (pathname.startsWith("/bookings/")) return "Session";
  if (pathname.startsWith("/rooms/")) return "Room";
  if (pathname.startsWith("/events/")) return "Event";
  if (pathname.startsWith("/payments/")) return "Payments";
  if (pathname.startsWith("/passes/")) return "Passes";
  if (pathname.startsWith("/managers/")) return "Managers";
  if (pathname.startsWith("/analytics/")) return "Analytics";
  if (pathname.startsWith("/my-classes/")) return "My Classes";
  if (pathname.startsWith("/settings/")) return "Settings";
  if (pathname.startsWith("/studio-announcements/")) return "Announcements";
  if (pathname.startsWith("/messages/")) return "Messages";
  return "Klasly";
}

type HeaderProps = {
  userName: string;
  userEmail: string;
  onSidebarToggle?: () => void;
};

export default function Header({ userName, userEmail, onSidebarToggle }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Escape キーでメニューを閉じる
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // 名前のイニシャルを取得
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 sm:px-6">
      {/* モバイル: ハンバーガー + ページタイトル */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          aria-label="Open menu"
          onClick={onSidebarToggle ?? (() => {})}
          className="flex shrink-0 rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <span className="truncate text-lg font-semibold text-gray-900">
          {getPageTitle(pathname)}
        </span>
      </div>

      {/* Help + ユーザーメニュー */}
      <div className="flex items-center gap-2">
      <Link
        href="/help"
        target="_blank"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        title="Help Center"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18.75h.007v.008H12v-.008z" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      </Link>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
            {initials}
          </div>
          <span className="hidden text-sm font-medium text-gray-700 sm:block">
            {userName}
          </span>
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
          <div role="menu" className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500">{userEmail}</p>
            </div>
            <button
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>
      </div>
    </header>
  );
}
