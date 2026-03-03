"use client";

import Link from "next/link";
import MemberHeader from "./member-header";
import TourProvider from "@/components/tour/TourProvider";

type MemberLayoutClientProps = {
  userName: string;
  userEmail: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  onboardingStartedAt: string | null;
  userId: string;
  children: React.ReactNode;
};

export default function MemberLayoutClient({
  userName,
  userEmail,
  onboardingCompleted,
  onboardingStep,
  onboardingStartedAt,
  userId,
  children,
}: MemberLayoutClientProps) {
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
          showTourHelp
        />
        <nav className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-4xl gap-6 px-4 py-3">
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
            <Link
              href="/my-payments"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Payments
            </Link>
          </div>
        </nav>
        <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      </div>
    </TourProvider>
  );
}
