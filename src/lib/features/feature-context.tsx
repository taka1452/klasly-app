"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FeatureKey } from "./feature-keys";

type FeatureFlags = Record<string, boolean>;

const FeatureContext = createContext<FeatureFlags>({});

export function FeatureProvider({
  features,
  children,
}: {
  features: FeatureFlags;
  children: ReactNode;
}) {
  return (
    <FeatureContext.Provider value={features}>
      {children}
    </FeatureContext.Provider>
  );
}

/**
 * Check feature flags from client components.
 *
 * Usage:
 *   const { isEnabled } = useFeature();
 *   if (isEnabled(FEATURE_KEYS.ROOM_MANAGEMENT)) { ... }
 */
export function useFeature() {
  const features = useContext(FeatureContext);

  return {
    isEnabled: (key: FeatureKey | string): boolean => {
      return features[key] ?? false;
    },
    features,
  };
}
