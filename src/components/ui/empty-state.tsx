import Link from "next/link";
import { HelpCircle } from "lucide-react";

type EmptyStateProps = {
  /** Icon (lucide-react component) */
  icon?: React.ReactNode;
  /** Heading */
  title: string;
  /** Description explaining this page's purpose */
  description?: string;
  /** Primary CTA label */
  actionLabel?: string;
  /** Primary CTA link */
  actionHref?: string;
  /** Secondary action label (e.g., "Import CSV") */
  secondaryLabel?: string;
  /** Secondary action link */
  secondaryHref?: string;
  /** Help article link */
  helpHref?: string;
  /** Help link label */
  helpLabel?: string;
  /**
   * Optional iframe-embeddable URL for a short walkthrough (~30–60s).
   * Mux / Bunny / YouTube embed links all work. When set, a 16:9 player
   * is rendered between the description and the CTAs.
   */
  videoUrl?: string;
  /** Accessible title for the embedded iframe. Falls back to the heading. */
  videoTitle?: string;
};

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  secondaryLabel,
  secondaryHref,
  helpHref,
  helpLabel = "Learn more",
  videoUrl,
  videoTitle,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-6 py-16 text-center">
      {/* Icon */}
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>

      {/* Description */}
      {description && (
        <p className="mt-2 max-w-sm text-sm text-gray-500 leading-relaxed">
          {description}
        </p>
      )}

      {/* Walkthrough video */}
      {videoUrl && (
        <div className="mt-5 w-full max-w-md">
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-gray-100">
            <iframe
              src={videoUrl}
              title={videoTitle || `Walkthrough: ${title}`}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      {(actionLabel || secondaryLabel) && (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {actionLabel && actionHref && (
            <Link href={actionHref} className="btn-primary">
              {actionLabel}
            </Link>
          )}
          {secondaryLabel && secondaryHref && (
            <Link href={secondaryHref} className="btn-secondary">
              {secondaryLabel}
            </Link>
          )}
        </div>
      )}

      {/* Help link */}
      {helpHref && (
        <Link
          href={helpHref}
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-500 transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          {helpLabel}
        </Link>
      )}
    </div>
  );
}
