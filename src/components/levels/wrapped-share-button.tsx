"use client";

import { useState } from "react";

type Props = {
  year: number;
  preview: boolean;
};

/**
 * Tries the Web Share API with a real PNG file first (best UX on iOS PWA
 * and Android). Falls back to opening the OG image in a new tab so users
 * can long-press to save. Active scale gives press feedback per the
 * design-engineering spec.
 */
export default function WrappedShareButton({ year, preview }: Props) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(
    "Tap to save or share."
  );

  const url = `/api/og/wrapped/${year}${preview ? "?preview=1" : ""}`;

  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (typeof navigator === "undefined") return;

    // Only intercept when we can attempt a real share. Otherwise let the
    // anchor's default open-in-tab behavior run for long-press save.
    if (!("share" in navigator)) return;

    e.preventDefault();
    setBusy(true);
    setHint(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const file = new File([blob], `klasly-wrapped-${year}.png`, {
        type: "image/png",
      });
      const shareData = {
        files: [file],
        title: `My ${year} on the mat`,
        text: `Here's my ${year} year-in-review with Klasly.`,
      };
      // canShare check guards Safari iOS where files may not be supported
      if (
        "canShare" in navigator &&
        typeof navigator.canShare === "function" &&
        navigator.canShare(shareData)
      ) {
        await navigator.share(shareData);
        setHint("Shared.");
      } else {
        // Fallback: open in new tab
        window.open(url, "_blank", "noopener,noreferrer");
        setHint("Long-press the image to save it.");
      }
    } catch (err) {
      // User cancellation throws AbortError — silent
      const isAbort =
        err instanceof Error && err.name === "AbortError";
      if (!isAbort) {
        window.open(url, "_blank", "noopener,noreferrer");
        setHint("Long-press the image to save it.");
      } else {
        setHint("Tap to save or share.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        aria-busy={busy}
        className="btn-primary mt-6"
      >
        {busy ? "Preparing image…" : "Save or share"}
      </a>
      {hint && (
        <p className="mt-3 text-xs text-gray-500" aria-live="polite">
          {hint}
        </p>
      )}
    </>
  );
}
