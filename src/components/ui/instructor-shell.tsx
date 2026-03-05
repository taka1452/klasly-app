"use client";

import { useState, useEffect } from "react";
import InstructorSidebar from "./instructor-sidebar";
import InstructorHeader from "./instructor-header";
import TourProvider from "@/components/tour/TourProvider";

type InstructorShellProps = {
  children: React.ReactNode;
  studioName: string;
  userName: string;
  userEmail: string;
  onboardingCompleted?: boolean;
  onboardingStep?: number;
  onboardingStartedAt?: string | null;
  userId?: string;
};

export default function InstructorShell({
  children,
  studioName,
  userName,
  userEmail,
  onboardingCompleted = true,
  onboardingStep = 0,
  onboardingStartedAt = null,
  userId,
}: InstructorShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <TourProvider
      role="instructor"
      onboardingCompleted={onboardingCompleted}
      onboardingStep={onboardingStep}
      onboardingStartedAt={onboardingStartedAt}
      userId={userId}
    >
    <div className="flex h-screen bg-gray-50">
      <button
        type="button"
        aria-label="Close menu"
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <InstructorSidebar
        studioName={studioName}
        isMobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <InstructorHeader
          userName={userName}
          userEmail={userEmail}
          onSidebarToggle={() => setSidebarOpen((o) => !o)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
    </TourProvider>
  );
}
