"use client";

export function WaiverPresetIcon({
  presetId,
  selected,
  className: customClass,
}: {
  presetId: string;
  selected?: boolean;
  className?: string;
}) {
  const base = "h-6 w-6 shrink-0";
  const color = selected ? "text-brand-600" : "text-gray-500";
  const className = customClass ?? `${base} ${color}`;

  switch (presetId) {
    case "general-fitness":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9h2v6H6zM16 9h2v6h-2zM8 12h8M7 9V7.5a1 1 0 011-1h1M17 9V7.5a1 1 0 00-1-1h-1" />
        </svg>
      );
    case "yoga-studio":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v3M10 11l2 1.5 2-1.5M12 14v4" />
        </svg>
      );
    case "dance-studio":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18M9 6l3-3 3 3M9 18l3 3 3-3" />
        </svg>
      );
    case "blank":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12h6M9 16h6M7 20h10a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      );
  }
}
