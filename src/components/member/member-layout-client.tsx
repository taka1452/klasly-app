"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MemberHeader from "./member-header";
import TourProvider from "@/components/tour/TourProvider";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import MemberBottomNav from "@/components/ui/member-bottom-nav";

type MemberLayoutClientProps = {
  userName: string;
  userEmail: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  onboardingStartedAt: string | null;
  userId: string;
  memberCredits: number | null;
  children: React.ReactNode;
};

export default function MemberLayoutClient({
  userName,
  userEmail,
  onboardingCompleted,
  onboardingStep,
  onboardingStartedAt,
  userId,
  memberCredits,
  children,
}: MemberLayoutClientProps) {
  const { isEnabled } = useFeature();
  const showPasses = isEnabled(FEATURE_KEYS.STUDIO_PASS);
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `text-sm font-medium ${
      pathname === href
        ? "text-brand-700 font-semibold"
        : "text-gray-600 hover:text-gray-900"
    }`;

  return (
    <TourProvider
      role="member"
      onboardingCompleted={onboardingCompleted}
      onboardingStep={onboardingStep}
      onboardingStartedAt={onboardingStartedAt}
      userId={userId}
    >
      <div className="min-h-screen bg-gray-50">
        <MemberHeader
          userName={userName}
          userEmail={userEmail}
        />
        <nav className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-2 md:py-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-4 overflow-x-auto scrollbar-hide md:gap-6 -mx-4 px-4 md:mx-0 md:px-0">
                <Link
                  href="/schedule"
                  className={`shrink-0 ${linkClass("/schedule")}`}
                >
                  Schedule
                </Link>
                <Link
                  href="/my-bookings"
                  className={`shrink-0 ${linkClass("/my-bookings")}`}
                  data-tour="my-bookings"
                >
                  Bookings
                </Link>
                <Link
                  href="/purchase"
                  className={`shrink-0 ${linkClass("/purchase")}`}
                >
                  Purchase
                </Link>
                {showPasses && (
                  <Link
                    href="/my-passes"
                    className={`shrink-0 ${linkClass("/my-passes")}`}
                  >
                    Passes
                  </Link>
                )}
                <Link
                  href="/my-payments"
                  className={`shrink-0 ${linkClass("/my-payments")}`}
                >
                  Payments
                </Link>
                <Link
                  href="/messages"
                  className={`shrink-0 ${linkClass("/messages")}`}
                >
                  Messages
                </Link>
                <Link
                  href="/notification-settings"
                  className={`shrink-0 ${linkClass("/notification-settings")}`}
                >
                  Settings
                </Link>
              </div>
              {memberCredits !== null && (
                <span className="ml-4 hidden shrink-0 text-sm text-gray-500 sm:inline">
                  Credits:{" "}
                  <span className={`font-semibold ${memberCredits === 0 ? "text-amber-600" : "text-gray-900"}`}>
                    {memberCredits === -1 ? "Unlimited" : memberCredits}
                  </span>
                </span>
              )}
            </div>
          </div>
        </nav>
        {/* Mobile credit bar */}
        {memberCredits !== null && (
          <div className="border-b border-gray-100 bg-white px-4 py-1.5 text-center sm:hidden">
            <span className="text-xs text-gray-500">
              Credits:{" "}
              <span className={`text-sm font-bold ${memberCredits === 0 ? "text-amber-600" : "text-gray-900"}`}>
                {memberCredits === -1 ? "Unlimited" : memberCredits}
              </span>
            </span>
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-4 pb-20 md:pb-0 md:py-6">{children}</main>
        <MemberBottomNav />
      </div>
    </TourProvider>
  );
}
