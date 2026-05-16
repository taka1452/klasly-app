"use client";

import { useEffect, useRef, useState } from "react";

function pickGreeting(hour: number): string {
  if (hour < 5) return "Hello";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const SESSION_KEY = "greeting-animated";

/**
 * Time-of-day greeting that resolves on the client so it always matches
 * the viewer's local clock. Renders the static fallback during SSR to
 * avoid layout shift.
 *
 * On the first dashboard visit per session, each word fades in with a
 * stagger. Subsequent visits within the same tab session skip the
 * animation so it doesn't get repetitive.
 */
export function TimeOfDayGreeting({
  fallback = "Welcome back",
  name,
}: {
  fallback?: string;
  name: string | null | undefined;
}) {
  const [greeting, setGreeting] = useState<string>(fallback);
  const [animate, setAnimate] = useState(false);
  const didRun = useRef(false);

  useEffect(() => {
    setGreeting(pickGreeting(new Date().getHours()));

    if (didRun.current) return;
    didRun.current = true;

    try {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        setAnimate(true);
        sessionStorage.setItem(SESSION_KEY, "1");
      }
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  const displayName = name || "there";
  const fullText = `${greeting}, ${displayName}!`;

  if (!animate) return <>{fullText}</>;

  const words = fullText.split(" ");
  return (
    <span className="inline-flex flex-wrap gap-x-[0.25em]">
      {words.map((word, i) => (
        <span
          key={i}
          className="greeting-word"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
