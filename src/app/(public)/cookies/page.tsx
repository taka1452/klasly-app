import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy - Klasly",
  description: "How Klasly uses cookies for authentication and session management.",
};

export default function CookiesPage() {
  return (
    <div>
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Klasly
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">
          Cookie Policy
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Last Updated: February 23, 2026
        </p>
      </div>

      <div className="prose prose-gray max-w-none space-y-6 text-sm">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Cookies We Use
          </h2>
          <p className="mt-2 text-gray-600">
            We use cookies only for authentication and session management. Our
            authentication provider (Supabase) sets cookies to keep you signed
            in. These are strictly necessary for the service to work.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Analytics and Tracking
          </h2>
          <p className="mt-2 text-gray-600">
            We do not use analytics cookies (e.g., Google Analytics) at this time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Third-Party Cookies
          </h2>
          <p className="mt-2 text-gray-600">
            We do not use third-party advertising or tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
          <p className="mt-2 text-gray-600">
            Questions? Email{" "}
            <a
              href="mailto:support@klasly.app"
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              support@klasly.app
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
