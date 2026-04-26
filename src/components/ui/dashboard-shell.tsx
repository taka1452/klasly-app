"use client";

import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import Header from "./header";
import SetupTaskList from "./setup-task-list";
import { PlanAccessProvider } from "./plan-access-provider";
import TourProvider from "@/components/tour/TourProvider";
import TourLauncher from "@/components/tour/TourLauncher";
import type { PlanAccess } from "@/lib/plan-guard";
import type { SetupTask } from "./setup-task-list";
import type { ManagerPermissions } from "@/lib/auth/check-manager-permission";

type DashboardShellProps = {
  children: React.ReactNode;
  currentRole: string;
  studioName: string;
  userName: string;
  userEmail: string;
  planAccess?: PlanAccess;
  showAdminLink?: boolean;
  isAlsoInstructor?: boolean;
  managerPermissions?: ManagerPermissions | null;
  onboardingCompleted?: boolean;
  onboardingStep?: number;
  onboardingStartedAt?: string | null;
  userId?: string;
  banner?: React.ReactNode;
  setupTasks?: SetupTask[];
  setupGuideHref?: string | null;
};

export default function DashboardShell({
  children,
  currentRole,
  studioName,
  userName,
  userEmail,
  planAccess,
  showAdminLink = false,
  isAlsoInstructor = false,
  managerPermissions = null,
  onboardingCompleted = true,
  onboardingStep = 0,
  onboardingStartedAt = null,
  userId,
  banner,
  setupTasks = [],
  setupGuideHref = null,
}: DashboardShellProps) {
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
      role={currentRole}
      onboardingCompleted={onboardingCompleted}
      onboardingStep={onboardingStep}
      onboardingStartedAt={onboardingStartedAt}
      userId={userId}
    >
    <div className="flex h-dvh bg-gray-50">
      <button
        type="button"
        aria-label="Close menu"
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <Sidebar
        currentRole={currentRole}
        studioName={studioName}
        isMobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
        showAdminLink={showAdminLink}
        isAlsoInstructor={isAlsoInstructor}
        managerPermissions={managerPermissions}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <Header
          userName={userName}
          userEmail={userEmail}
          onSidebarToggle={() => setSidebarOpen((o) => !o)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 pb-32 md:p-6 md:pb-32">
          {banner && <div className="mb-6">{banner}</div>}
          {planAccess ? (
            <PlanAccessProvider planAccess={planAccess}>
              {children}
            </PlanAccessProvider>
          ) : (
            children
          )}
        </main>
      </div>
      {currentRole === "owner" &&
        setupTasks.length > 0 &&
        !setupTasks.every((t) => t.done) && (
          <SetupTaskList
            tasks={setupTasks}
            title="Setup checklist"
            guideHref={setupGuideHref}
            guideLabel="View full setup guide"
          />
        )}
      <TourLauncher />
    </div>
    </TourProvider>
  );
}
