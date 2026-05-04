"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  Bookmark,
  CreditCard,
  Wallet,
  TrendingUp,
  CalendarClock,
  Ticket,
  Users,
  Video,
  MessageCircle,
  Settings,
  HelpCircle,
  UserCog,
  LogOut,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type DrawerItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  showPasses: boolean;
  showAppointments: boolean;
  showCommunity: boolean;
  showVideos: boolean;
  showMyStats: boolean;
};

export default function MemberDrawer({
  open,
  onClose,
  userName,
  userEmail,
  showPasses,
  showAppointments,
  showCommunity,
  showVideos,
  showMyStats,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    onClose();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const primary: DrawerItem[] = [
    { label: "Schedule", href: "/schedule", icon: Calendar },
    { label: "My Bookings", href: "/my-bookings", icon: Bookmark },
    { label: "Purchase Credits", href: "/purchase", icon: CreditCard },
    { label: "Messages", href: "/messages", icon: MessageCircle },
  ];

  const secondary: DrawerItem[] = [
    ...(showMyStats
      ? [{ label: "My Stats", href: "/my-stats", icon: TrendingUp }]
      : []),
    ...(showAppointments
      ? [
          {
            label: "Appointments",
            href: "/my-appointments",
            icon: CalendarClock,
          },
        ]
      : []),
    ...(showPasses
      ? [{ label: "My Passes", href: "/my-passes", icon: Ticket }]
      : []),
    { label: "Payments", href: "/my-payments", icon: Wallet },
    ...(showCommunity
      ? [{ label: "Community", href: "/community", icon: Users }]
      : []),
    ...(showVideos
      ? [{ label: "Videos", href: "/videos", icon: Video }]
      : []),
    {
      label: "Notification Settings",
      href: "/notification-settings",
      icon: Settings,
    },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <div
        style={{ transitionTimingFunction: "var(--ease-out-strong)" }}
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        style={{ transitionTimingFunction: "var(--ease-drawer)" }}
        className={`fixed right-0 top-0 z-[61] flex h-[100dvh] w-[82%] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 motion-reduce:transition-none md:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-gray-900">
              {userName}
            </p>
            <p className="truncate text-xs text-gray-500">{userEmail}</p>
          </div>
          <button
            onClick={onClose}
            style={{ transitionTimingFunction: "var(--ease-out-strong)" }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-[transform,background-color] duration-150 hover:bg-gray-100 active:scale-[0.97] motion-reduce:active:scale-100"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div
          key={open ? "open" : "closed"}
          className="flex-1 overflow-y-auto px-3 py-3"
        >
          <ul className="space-y-1">
            {primary.map((item, i) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <li
                  key={item.href}
                  className={open ? "stagger-item" : undefined}
                  style={open ? { animationDelay: `${80 + i * 35}ms` } : undefined}
                >
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors duration-150 ${
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        active ? "text-brand-600" : "text-gray-400"
                      }`}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="my-3 border-t border-gray-100" />
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            More
          </p>
          <ul className="space-y-1">
            {secondary.map((item, i) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <li
                  key={item.href}
                  className={open ? "stagger-item" : undefined}
                  style={
                    open
                      ? {
                          animationDelay: `${
                            80 + (primary.length + i) * 35
                          }ms`,
                        }
                      : undefined
                  }
                >
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors duration-150 ${
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        active ? "text-brand-600" : "text-gray-400"
                      }`}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="border-t border-gray-100 px-3 py-2 pb-[max(env(safe-area-inset-bottom),8px)]">
          <Link
            href="/account"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50"
          >
            <UserCog className="h-5 w-5 text-gray-400" />
            Account settings
          </Link>
          <Link
            href="/help"
            target="_blank"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50"
          >
            <HelpCircle className="h-5 w-5 text-gray-400" />
            Help
          </Link>
          <button
            onClick={handleLogout}
            style={{ transitionTimingFunction: "var(--ease-out-strong)" }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-red-600 transition-[transform,background-color] duration-150 hover:bg-red-50 active:scale-[0.985] motion-reduce:active:scale-100"
          >
            <LogOut className="h-5 w-5 text-red-500" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
