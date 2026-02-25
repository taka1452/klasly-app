import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <Link href="/" className="mb-8 text-xl font-bold text-brand-700">
        Klasly
      </Link>
      <div className="card max-w-md text-center">
        <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          The page you are looking for does not exist.
        </p>
        <Link href="/" className="btn-primary mt-6 inline-block">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
