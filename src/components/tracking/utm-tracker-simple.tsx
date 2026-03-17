"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * UTM tracker for contexts without FeatureProvider (e.g. widget).
 * Always records when UTM params are present.
 */
export default function UTMTrackerSimple({ studioId }: { studioId: string }) {
  const searchParams = useSearchParams();

  useEffect(() => {
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
  }, [studioId, searchParams]);

  return null;
}
