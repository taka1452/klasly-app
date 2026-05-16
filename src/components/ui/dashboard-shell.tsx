"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";
import Header from "./header";
import SetupTaskList from "./setup-task-list";
import { PlanAccessProvider } from "./plan-access-provider";
import TourProvider from "@/components/tour/TourProvider";
import TourLauncher from "@/components/tour/TourLauncher";
import CommandPalette from "./command-palette";
import PushPrompt from "@/components/pwa/push-prompt";
import type { PlanAccess } from "@/lib/plan-guard";
import type { SetupTask } from "./setup-task-list";
import type { ManagerPermissions } from "@/lib/auth/check-manager-permission";

type DashboardShellProps = {
  children: React.ReactNode;
  currentRole: string;
  studioName: string;
  studioId?: string;
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
  studioId,
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
  const pathname = usePathname();

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
        isAlsoInstructor={isAlsoInstructor}
        managerPermissions={managerPermissions}
        showAdminLink={showAdminLink}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header
          userName={userName}
          userEmail={userEmail}
          onSidebarToggle={() => setSidebarOpen((o) => !o)}
          showAdminLink={showAdminLink}
        />
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-3 pb-32 md:px-6 md:pt-4 md:pb-32">
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
      {/* Dashboard page already shows an inline SetupChecklistCard,
          so hide the floating panel there to avoid overlap. */}
      {currentRole === "owner" &&
        setupTasks.length > 0 &&
        !setupTasks.every((t) => t.done) &&
        pathname !== "/dashboard" && (
          <SetupTaskList
            tasks={setupTasks}
            title="Setup checklist"
            guideHref={setupGuideHref}
            guideLabel="View full setup guide"
          />
        )}
      <TourLauncher />
      <CommandPalette role={currentRole} />
      <PushPrompt studioId={studioId} />
    </div>
    </TourProvider>
  );
}
