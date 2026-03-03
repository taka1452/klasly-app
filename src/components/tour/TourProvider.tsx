"use client";

import { createContext, useContext, useCallback, useState } from "react";
import TourOverlay from "./TourOverlay";

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

  const showTour =
    (role === "owner" || role === "instructor" || role === "member") &&
    (!onboardingCompleted || forceStart);

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
