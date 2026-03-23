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
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-500 transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          {helpLabel}
        </Link>
      )}
    </div>
  );
}
