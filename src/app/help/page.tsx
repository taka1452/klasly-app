"use client";

import Link from "next/link";
import { helpCategories } from "@/data/help-categories";
import HelpSearch from "@/components/help/help-search";
import {
  Rocket,
  Calendar,
  Users,
  CreditCard,
  FileCheck,
  MessageSquare,
  Building2,
  Mountain,
  BarChart3,
  Settings,
  BookOpen,
  ArrowRight,
} from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  Rocket: <Rocket className="h-6 w-6" />,
  Calendar: <Calendar className="h-6 w-6" />,
  Users: <Users className="h-6 w-6" />,
  CreditCard: <CreditCard className="h-6 w-6" />,
  FileCheck: <FileCheck className="h-6 w-6" />,
  MessageSquare: <MessageSquare className="h-6 w-6" />,
  Building2: <Building2 className="h-6 w-6" />,
  Mountain: <Mountain className="h-6 w-6" />,
  BarChart3: <BarChart3 className="h-6 w-6" />,
  Settings: <Settings className="h-6 w-6" />,
  BookOpen: <BookOpen className="h-6 w-6" />,
};

const quickActions = [
  {
    label: "Set up my studio for the first time",
    href: "/help/getting-started/studio-setup-overview",
  },
  {
    label: "Add my existing members",
    href: "/help/members/import-members-csv",
  },
  {
    label: "Accept payments online",
    href: "/help/getting-started/connect-stripe",
  },
  {
    label: "Let instructors manage their own classes",
    href: "/help/collective-mode/collective-overview",
  },
  {
    label: "Embed my schedule on my website",
    href: "/help/settings/embed-wordpress-widget",
  },
];

export default function HelpCenterPage() {
  const ownerCategories = helpCategories
    .filter((c) => c.id !== "member-guide")
    .sort((a, b) => a.order - b.order);

  const memberCategory = helpCategories.find((c) => c.id === "member-guide");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1a3a5c] px-6 pb-14 pt-12 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
          Help Center
        </p>
        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          How can we help?
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Guides and answers for using Klasly
        </p>
      </div>

      {/* Search */}
      <div className="relative z-10 mx-auto -mt-6 max-w-xl px-5">
        <HelpSearch />
      </div>

      <div className="mx-auto max-w-3xl px-5 pb-16 pt-10">
        {/* Quick Actions */}
        <div className="mb-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            What do you want to do?
          </h2>
          <div className="space-y-1">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-white hover:shadow-sm"
              >
                <span>{action.label}</span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>

        {/* Browse by topic */}
        <div className="mb-10">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Browse by topic
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ownerCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/help/${cat.id}`}
                className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-brand-300 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  {ICON_MAP[cat.icon] ?? null}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {cat.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                    {cat.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Member Guide */}
        {memberCategory && (
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              For Members
            </h2>
            <Link
              href={`/help/${memberCategory.id}`}
              className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                {ICON_MAP[memberCategory.icon] ?? null}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">
                  {memberCategory.title}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                  {memberCategory.description}
                </p>
              </div>
            </Link>
          </div>
        )}

        {/* Contact */}
        <div className="mt-10 rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-gray-900">
            Still need help?
          </p>
          <p className="mt-1 text-xs text-gray-500">
            We&apos;re happy to help with any questions.
          </p>
          <a
            href="mailto:support@klasly.app"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1a3a5c] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#15304d]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
            support@klasly.app
          </a>
        </div>
      </div>
    </div>
  );
}
