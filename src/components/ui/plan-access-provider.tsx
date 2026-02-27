"use client";

import { createContext, useContext } from "react";
import type { PlanAccess } from "@/lib/plan-guard";

const PlanAccessContext = createContext<PlanAccess | null>(null);

export function PlanAccessProvider({
  children,
  planAccess,
}: {
  children: React.ReactNode;
  planAccess: PlanAccess;
}) {
  return (
    <PlanAccessContext.Provider value={planAccess}>
      {children}
    </PlanAccessContext.Provider>
  );
}

export function usePlanAccess(): PlanAccess | null {
  return useContext(PlanAccessContext);
}
