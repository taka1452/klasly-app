"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ManagerPermissions } from "@/lib/auth/check-manager-permission";

/**
 * Information about the currently signed-in user that client components need
 * for permission gating. Mirrors what the dashboard layout already fetches
 * server-side so we don't pay an extra round-trip per page.
 *
 * `role` is the canonical role string ("owner" | "manager" | "instructor" |
 * "member"). For owners we always allow everything regardless of
 * `managerPermissions`; for managers we honour the toggles set on the
 * Managers page.
 */
export type ViewerInfo = {
  role: string;
  managerPermissions: ManagerPermissions | null;
};

// Default fails closed: an unknown viewer role outside a ViewerProvider
// gets no manager-permission grants. The dashboard layout always wraps
// children in a ViewerProvider with the real values; this default only
// fires on misuse (e.g. someone renders a permission-gated component
// outside the dashboard tree). Defaulting to "owner" here would silently
// expose privileged UI in those cases.
const ViewerContext = createContext<ViewerInfo>({
  role: "",
  managerPermissions: null,
});

export function ViewerProvider({
  viewer,
  children,
}: {
  viewer: ViewerInfo;
  children: ReactNode;
}) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer(): ViewerInfo {
  return useContext(ViewerContext);
}

/**
 * Common permission checks that wrap the role + managerPermissions logic so
 * call sites don't have to repeat the "owner is always allowed" gate.
 */
export function useViewerPermissions() {
  const { role, managerPermissions } = useContext(ViewerContext);
  const isOwner = role === "owner";
  const isManager = role === "manager";

  function check(key: keyof ManagerPermissions): boolean {
    if (isOwner) return true;
    if (isManager) return Boolean(managerPermissions?.[key]);
    // instructors / members: not gated by manager permissions
    return false;
  }

  return {
    role,
    isOwner,
    isManager,
    canExportData: check("can_export_data"),
    canManageClassPricing: isOwner
      ? true
      : isManager
        ? Boolean(
            managerPermissions?.can_manage_class_pricing ||
              // Backwards compat: a manager with the broader Classes
              // permission can edit prices too.
              managerPermissions?.can_manage_classes
          )
        : false,
    canShowTutorial: isOwner
      ? true
      : isManager
        ? Boolean(managerPermissions?.can_show_tutorial)
        : true,
  };
}
