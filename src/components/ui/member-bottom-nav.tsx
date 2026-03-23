"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Bookmark, CreditCard, User } from "lucide-react";

const NAV_ITEMS = [
  {
    label: "Schedule",
    href: "/schedule",
    icon: Calendar,
  },
  {
    label: "Bookings",
    href: "/my-bookings",
    icon: Bookmark,
  },
  {
    label: "Credits",
    href: "/purchase",
    icon: CreditCard,
  },
  {
    label: "Account",
    href: "/my-payments",
    icon: User,
  },
];

export default function MemberBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white md:hidden">
      <div className="flex items-center justify-around pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                isActive
                  ? "text-brand-600"
                  : "text-gray-400 active:text-gray-600"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${
                  isActive ? "text-brand-600" : "text-gray-400"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
