"use client";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        {/* Wi-Fiアイコン（オフライン状態を示す） */}
        <svg
          className="mx-auto h-16 w-16 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"
          />
        </svg>

        <h1 className="mt-6 text-2xl font-bold text-gray-900">
          You&apos;re Offline
        </h1>
        <p className="mt-3 text-base text-gray-600">
          It looks like you&apos;ve lost your internet connection.
          <br />
          Please check your connection and try again.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="mt-8 inline-flex items-center rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
        >
          Try Again
        </button>

        <p className="mt-4 text-xs text-gray-400">
          Some previously viewed pages may still be available.
        </p>
      </div>
    </div>
  );
}
