"use client";

import { useEffect } from "react";
import { useTourActions } from "./TourProvider";

/**
 * Mounts a tiny effect that launches the onboarding tour when the URL
 * carries `?tour=1`, then strips the param so refreshes don't re-fire it.
 *
 * Used so the "Complete the tutorial" task in the setup checklist (a server
 * component) can deep-link straight into the tour without needing its own
 * client wrapper.
 *
 * Reads location directly instead of `useSearchParams` so the component
 * doesn't require a Suspense boundary in its parent route.
 */
export default function TourLauncher() {
  const tourActions = useTourActions();

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __tourLauncherRan?: { hasActions: boolean; hasParam: boolean } }).__tourLauncherRan = {
        hasActions: !!tourActions,
        hasParam: new URLSearchParams(window.location.search).get("tour") === "1",
      };
    }
    if (!tourActions) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") !== "1") return;

    tourActions.restartTour();

    // Drop the query so a reload or share-link doesn't replay the tour.
    params.delete("tour");
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }, [tourActions]);

  return null;
}
