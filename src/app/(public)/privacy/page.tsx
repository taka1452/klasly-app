import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - Klasly",
  description:
    "Klasly's privacy policy explains how we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Last Updated: February 23, 2026
        </p>
      </div>

      <div className="prose prose-gray max-w-none space-y-8 text-sm">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Information We Collect
          </h2>
          <p className="mt-2 text-gray-600">
            We collect information you provide when using our service:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-gray-600">
            <li>Name, email address, and phone number</li>
            <li>Studio information (name, contact details, address)</li>
            <li>Class schedules, member lists, and booking records</li>
            <li>Attendance records</li>
            <li>Payment information (when payment features are used in the future)</li>
            <li>Usage logs (IP address, browser type, pages visited)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            How We Use Your Information
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-gray-600">
            <li>To provide and maintain our service</li>
            <li>To manage your account and process your requests</li>
            <li>To communicate with you (account-related notifications, support)</li>
            <li>To improve our service and fix issues</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Information Sharing
          </h2>
          <p className="mt-2 font-medium text-gray-900">
            We do not sell your personal information to third parties.
          </p>
          <p className="mt-2 text-gray-600">
            We may share your information only in these cases:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-gray-600">
            <li>When required by law or to respond to legal requests</li>
            <li>With service providers who help us run our platform (e.g., Supabase for data storage, Vercel for hosting) under strict confidentiality agreements</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Data Retention
          </h2>
          <p className="mt-2 text-gray-600">
            We keep your data while your account is active. If you request
            deletion, we will delete your data within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Your Rights
          </h2>
          <ul className="mt-2 space-y-3 text-gray-600">
            <li>
              <strong className="text-gray-900">Right to Access:</strong> You can
              request to see the data we hold about you.
            </li>
            <li>
              <strong className="text-gray-900">Right to Correction:</strong> You
              can request corrections to inaccurate data.
            </li>
            <li>
              <strong className="text-gray-900">Right to Deletion (Right to be
              Forgotten):</strong> You can request deletion of your account and
              all associated data.
            </li>
            <li>
              <strong className="text-gray-900">Right to Export:</strong> You can
              download a copy of your data.
            </li>
            <li>
              <strong className="text-gray-900">Right to Opt-Out:</strong> You can
              opt out of marketing emails at any time.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            California Residents (CCPA)
          </h2>
          <p className="mt-2 text-gray-600">
            If you are a California resident, you have additional rights under
            the California Consumer Privacy Act (CCPA). You may request
            disclosure of the categories and specific pieces of personal
            information we collect. We do not sell personal information. You have
            the right to opt out of the sale of personal information; since we
            do not sell data, a &quot;Do Not Sell My Personal Information&quot;
            link is not applicable, but we fully support your privacy choices.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Children&apos;s Privacy
          </h2>
          <p className="mt-2 text-gray-600">
            Our service is not intended for users under 13. We do not knowingly
            collect data from children under 13. If we learn that we have
            collected data from a child under 13, we will delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Security</h2>
          <p className="mt-2 text-gray-600">
            We use SSL/TLS encryption to protect data in transit. Our database
            has strict access controls. Multi-tenant data is isolated using Row
            Level Security (RLS) so your data is not accessible to other
            customers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Cookies</h2>
          <p className="mt-2 text-gray-600">
            We use only the minimum cookies needed for authentication and
            session management. We do not use cookies for advertising or
            tracking.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Changes to This Policy
          </h2>
          <p className="mt-2 text-gray-600">
            If we change this policy, we will notify you by email. Continued use
            of our service after changes means you accept the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
          <p className="mt-2 text-gray-600">
            Questions about this policy? Email us at{" "}
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
