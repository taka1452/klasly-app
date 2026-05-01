"use client";

import { createContext, useContext, useCallback, useState } from "react";
import TourOverlay from "./TourOverlay";
import { useViewerPermissions } from "@/lib/auth/viewer-context";

type TourContextValue = {
  restartTour: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTourActions() {
  const ctx = useContext(TourContext);
  return ctx;
}

type TourProviderProps = {
  role: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  onboardingStartedAt: string | null;
  userId: string | undefined;
  children: React.ReactNode;
};

export default function TourProvider({
  role,
  onboardingCompleted,
  onboardingStep,
  onboardingStartedAt,
  userId,
  children,
}: TourProviderProps) {
  const [forceStart, setForceStart] = useState(false);

  const restartTour = useCallback(() => {
    setForceStart(true);
  }, []);

  // Managers respect the per-user Tutorial toggle on the Managers page; the
  // default for that column is true so newly-invited managers see the tour
  // unless an owner explicitly turns it off.
  const { canShowTutorial } = useViewerPermissions();
  const roleAllowsTour =
    role === "owner" ||
    role === "instructor" ||
    role === "member" ||
    (role === "manager" && canShowTutorial);

  const showTour = roleAllowsTour && (!onboardingCompleted || forceStart);

  return (
    <TourContext.Provider value={{ restartTour }}>
      {children}
      {showTour && (
        <TourOverlay
          role={role}
          onboardingCompleted={onboardingCompleted}
          onboardingStep={onboardingStep}
          onboardingStartedAt={onboardingStartedAt}
          userId={userId}
          forceStart={forceStart}
        />
      )}
    </TourContext.Provider>
  );
}
