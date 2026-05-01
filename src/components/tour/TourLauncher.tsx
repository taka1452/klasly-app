"use client";

import { useEffect } from "react";
import { useTourActions } from "./TourProvider";
import { useViewerPermissions } from "@/lib/auth/viewer-context";

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
  // Tutorial is a per-user UX preference (Tutorial permission on the
  // Managers page). Managers without it stay out of the onboarding overlay
  // even when the deep-link `?tour=1` appears in their URL.
  const { canShowTutorial } = useViewerPermissions();

  useEffect(() => {
    if (!canShowTutorial) return;
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
  }, [tourActions, canShowTutorial]);

  return null;
}
