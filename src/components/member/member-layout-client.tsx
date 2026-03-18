"use client";

import Link from "next/link";
import MemberHeader from "./member-header";
import TourProvider from "@/components/tour/TourProvider";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

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
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <div className="flex gap-6">
              <Link
                href="/schedule"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Schedule
              </Link>
              <Link
                href="/my-bookings"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
                data-tour="my-bookings"
              >
                My Bookings
              </Link>
              <Link
                href="/purchase"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Purchase
              </Link>
              {showPasses && (
                <Link
                  href="/my-passes"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Passes
                </Link>
              )}
              <Link
                href="/my-payments"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Payments
              </Link>
              <Link
                href="/messages"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Messages
              </Link>
            </div>
            {memberCredits !== null && (
              <span className="text-sm text-gray-500">
                Credits:{" "}
                <span className="font-semibold text-gray-900">
                  {memberCredits === -1 ? "Unlimited" : memberCredits}
                </span>
              </span>
            )}
          </div>
        </nav>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </div>
    </TourProvider>
  );
}
