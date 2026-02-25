import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service - Klasly",
  description:
    "Klasly's terms of service govern your use of our studio management platform.",
};

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Last Updated: February 23, 2026
        </p>
      </div>

      <div className="prose prose-gray max-w-none space-y-8 text-sm">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Acceptance of Terms
          </h2>
          <p className="mt-2 text-gray-600">
            By creating an account or using Klasly, you agree to these Terms of
            Service. If you do not agree, please do not use our service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Description of Service
          </h2>
          <p className="mt-2 text-gray-600">
            Klasly is a studio management SaaS for yoga, fitness, and dance
            studios. We help you manage classes, members, bookings, and related
            operations. Features may change over time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Account Registration
          </h2>
          <p className="mt-2 text-gray-600">
            You must provide accurate information when signing up. You are
            responsible for keeping your password secure and for all activity
            under your account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Free and Paid Plans
          </h2>
          <ul className="mt-2 space-y-2 text-gray-600">
            <li>
              <strong className="text-gray-900">Free:</strong> Up to 10 members
            </li>
            <li>
              <strong className="text-gray-900">Studio ($19/month):</strong> Up
              to 50 members
            </li>
            <li>
              <strong className="text-gray-900">Grow ($39/month):</strong> Unlimited
              members
            </li>
          </ul>
          <p className="mt-2 text-gray-600">
            Plan details and pricing may change. We will notify you before
            changes take effect.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Acceptable Use
          </h2>
          <p className="mt-2 text-gray-600">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-gray-600">
            <li>Use the service for any illegal purpose</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Scrape, crawl, or use automated tools to access the service without permission</li>
            <li>Reverse engineer or attempt to extract source code</li>
            <li>Interfere with the security or operation of the service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Intellectual Property
          </h2>
          <p className="mt-2 text-gray-600">
            The Klasly platform, design, and code are owned by Klasly. You may not
            copy or modify them. Your data (members, classes, bookings) remains
            yours.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Data Ownership
          </h2>
          <p className="mt-2 text-gray-600">
            You own the data you enter into Klasly. We use it only to provide
            and improve our service. See our Privacy Policy for details.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Limitation of Liability
          </h2>
          <p className="mt-2 text-gray-600">
            The service is provided &quot;as is.&quot; We are not liable for
            indirect, incidental, or consequential damages. Our total liability
            is limited to the amount you paid us in the 12 months before the
            claim.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Termination</h2>
          <p className="mt-2 text-gray-600">
            You may delete your account at any time from Settings. We may
            suspend or terminate your account if you violate these terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Dispute Resolution
          </h2>
          <p className="mt-2 text-gray-600">
            Disputes will be resolved through individual arbitration, not in
            court. You waive the right to participate in class actions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Governing Law
          </h2>
          <p className="mt-2 text-gray-600">
            These terms are governed by the laws of the State of California,
            USA.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Changes to Terms
          </h2>
          <p className="mt-2 text-gray-600">
            For significant changes, we will notify you at least 30 days in
            advance. Continued use after changes means you accept the new terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
          <p className="mt-2 text-gray-600">
            Questions? Email us at{" "}
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
