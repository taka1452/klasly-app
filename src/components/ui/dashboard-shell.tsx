"use client";

import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import Header from "./header";
import { PlanAccessProvider } from "./plan-access-provider";
import type { PlanAccess } from "@/lib/plan-guard";

type DashboardShellProps = {
  children: React.ReactNode;
  currentRole: string;
  studioName: string;
  userName: string;
  userEmail: string;
  planAccess?: PlanAccess;
  showAdminLink?: boolean;
  banner?: React.ReactNode;
};

export default function DashboardShell({
  children,
  currentRole,
  studioName,
  userName,
  userEmail,
  planAccess,
  showAdminLink = false,
  banner,
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
    <div className="flex h-screen bg-gray-50">
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
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userName={userName}
          userEmail={userEmail}
          onSidebarToggle={() => setSidebarOpen((o) => !o)}
        />
        <main className="flex-1 overflow-y-auto p-6">
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
    </div>
  );
}
