"use client";

import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import Header from "./header";

type DashboardShellProps = {
  children: React.ReactNode;
  currentRole: string;
  studioName: string;
  userName: string;
  userEmail: string;
};

export default function DashboardShell({
  children,
  currentRole,
  studioName,
  userName,
  userEmail,
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
      {/* モバイル: オーバーレイ背景 */}
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
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userName={userName}
          userEmail={userEmail}
          onSidebarToggle={() => setSidebarOpen((o) => !o)}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
