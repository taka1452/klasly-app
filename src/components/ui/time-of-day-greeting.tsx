"use client";

import { useEffect, useState } from "react";

function pickGreeting(hour: number): string {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Evening";
}

/**
 * Time-of-day greeting that resolves on the client so it always matches
 * the viewer's local clock. Renders the static fallback during SSR to
 * avoid layout shift.
 */
export function TimeOfDayGreeting({
  fallback = "Welcome back",
  name,
}: {
  fallback?: string;
  name: string | null | undefined;
}) {
  const [greeting, setGreeting] = useState<string>(fallback);

  useEffect(() => {
    setGreeting(pickGreeting(new Date().getHours()));
  }, []);

  return <>{greeting}, {name || "there"}!</>;
}
