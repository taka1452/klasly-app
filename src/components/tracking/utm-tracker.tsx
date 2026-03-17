"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";

export default function UTMTracker({ studioId }: { studioId: string }) {
  const searchParams = useSearchParams();
  const { isEnabled } = useFeature();

  useEffect(() => {
    if (!isEnabled(FEATURE_KEYS.UTM_TRACKING)) return;

    const utm_source = searchParams.get("utm_source");
    const utm_medium = searchParams.get("utm_medium");
    const utm_campaign = searchParams.get("utm_campaign");

    if (!utm_source && !utm_medium && !utm_campaign) return;

    const params = new URLSearchParams({
      studio_id: studioId,
      url: window.location.href,
      ...(utm_source && { utm_source }),
      ...(utm_medium && { utm_medium }),
      ...(utm_campaign && { utm_campaign }),
    });

    fetch(`/api/public/track?${params}`).catch(() => {});
  }, [studioId, searchParams, isEnabled]);

  return null;
}
