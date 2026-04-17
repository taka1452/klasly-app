import Link from 'next/link';

type Props = {
  href: string;
  label?: string;
};

export default function ContextHelpLink({ href, label = 'Help' }: Props) {
  return (
    <Link
      href={href}
      target="_blank"
      title={label}
      className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500 hover:text-brand-600 transition-colors"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18.75h.007v.008H12v-.008z"
        />
        <circle cx="12" cy="12" r="10" />
      </svg>
    </Link>
  );
}
