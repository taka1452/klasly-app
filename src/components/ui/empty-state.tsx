import Link from "next/link";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  actionLabel?: string;
  actionHref?: string;
};

const defaultIcon = (
  <svg
    className="mx-auto h-12 w-12 text-gray-400"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1}
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
    />
  </svg>
);

export default function EmptyState({
  icon = defaultIcon,
  title,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-6 py-16 text-center">
      {icon}
      <p className="mt-4 text-base font-medium text-gray-900">{title}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-primary mt-4">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
