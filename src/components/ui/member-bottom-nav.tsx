"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Bookmark, CreditCard, MessageCircle } from "lucide-react";

const NAV_ITEMS = [
  { label: "Schedule", href: "/schedule", icon: Calendar },
  { label: "Bookings", href: "/my-bookings", icon: Bookmark },
  { label: "Credits", href: "/purchase", icon: CreditCard },
  { label: "Messages", href: "/messages", icon: MessageCircle },
];

export default function MemberBottomNav() {
  const pathname = usePathname();

  return (
    <div
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-[max(env(safe-area-inset-bottom),12px)] md:hidden"
      aria-hidden={false}
    >
      <nav
        className="pointer-events-auto flex items-center gap-1 rounded-full border border-gray-200/80 bg-white/85 px-2 py-1.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18),0_2px_6px_-2px_rgba(0,0,0,0.08)] backdrop-blur-md"
        aria-label="Primary"
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`group relative flex min-w-[52px] flex-col items-center justify-center rounded-full px-3 py-2 text-[10px] font-semibold transition-[color,transform,background-color] duration-200 ease-out active:scale-[0.92] ${
                isActive
                  ? "bg-brand-600 text-white shadow-[0_4px_10px_-2px_rgba(0,116,197,0.45)]"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span
                className={`mt-0.5 ${
                  isActive ? "opacity-100" : "opacity-80"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
