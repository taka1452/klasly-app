"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type InstructorSidebarProps = {
  studioName: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
};

const instructorNavItems = [
  {
    label: "Dashboard",
    href: "/instructor",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
      </svg>
    ),
  },
  {
    label: "My Schedule",
    href: "/instructor/schedule",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: "Room Bookings",
    href: "/instructor/room-bookings",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  {
    label: "My Earnings",
    href: "/instructor/earnings",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "My Profile",
    href: "/instructor/profile",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

export default function InstructorSidebar({
  studioName,
  isMobileOpen = false,
  onMobileClose,
}: InstructorSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-200 ease-out md:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
          <Link href="/instructor" className="flex items-center gap-2">
            <span className="text-xl font-bold text-emerald-700">Klasly</span>
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onMobileClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="border-b border-gray-200 px-6 py-3">
          <p className="truncate text-sm font-medium text-gray-900">{studioName}</p>
          <p className="text-xs text-gray-400">Instructor</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {instructorNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/instructor" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span className={isActive ? "text-emerald-600" : "text-gray-400"}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 px-6 py-4 space-y-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <Link href="/privacy" onClick={onMobileClose} className="text-gray-500 hover:text-gray-700">
              Privacy
            </Link>
            <Link href="/terms" onClick={onMobileClose} className="text-gray-500 hover:text-gray-700">
              Terms
            </Link>
          </div>
        </div>
      </aside>

      <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <Link href="/instructor" className="flex items-center gap-2">
            <span className="text-xl font-bold text-emerald-700">Klasly</span>
          </Link>
        </div>
        <div className="border-b border-gray-200 px-6 py-3">
          <p className="truncate text-sm font-medium text-gray-900">{studioName}</p>
          <p className="text-xs text-gray-400">Instructor</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {instructorNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/instructor" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span className={isActive ? "text-emerald-600" : "text-gray-400"}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 px-6 py-4 space-y-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <Link href="/privacy" className="text-gray-500 hover:text-gray-700">
              Privacy
            </Link>
            <Link href="/terms" className="text-gray-500 hover:text-gray-700">
              Terms
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
