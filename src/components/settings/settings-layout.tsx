"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Calendar,
  FileCheck,
  Settings,
  Handshake,
  Gift,
  Bell,
  HelpCircle,
  LayoutGrid,
  Globe,
} from "lucide-react";

type SettingsNavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  show?: boolean;
};

type SettingsLayoutProps = {
  children: React.ReactNode;
  isCollectiveMode?: boolean;
};

export default function SettingsLayout({
  children,
  isCollectiveMode = false,
}: SettingsLayoutProps) {
  const pathname = usePathname();

  const navGroups: { title: string; items: SettingsNavItem[] }[] = [
    {
      title: "Payments & Billing",
      items: [
        {
          label: "Stripe Connect",
          href: "/settings/connect",
          icon: <CreditCard className="h-4 w-4" />,
        },
        {
          label: "Products & Pricing",
          href: "/settings/pricing",
          icon: <CreditCard className="h-4 w-4" />,
        },
        {
          label: "Subscription",
          href: "/settings/billing",
          icon: <CreditCard className="h-4 w-4" />,
        },
      ],
    },
    {
      title: "Scheduling",
      items: [
        {
          label: "Widget (Embed)",
          href: "/settings/widget",
          icon: <Globe className="h-4 w-4" />,
        },
      ],
    },
    {
      title: "Forms & Waivers",
      items: [
        {
          label: "Waiver Template",
          href: "/settings/waiver",
          icon: <FileCheck className="h-4 w-4" />,
        },
        {
          label: "Forms & documents",
          href: "/settings/forms",
          icon: <FileCheck className="h-4 w-4" />,
        },
      ],
    },
    {
      title: "Collective Mode",
      items: [
        {
          label: "Collective Setup",
          href: "/settings/collective-setup",
          icon: <Handshake className="h-4 w-4" />,
          show: isCollectiveMode,
        },
        {
          label: "Rooms",
          href: "/rooms/manage",
          icon: <LayoutGrid className="h-4 w-4" />,
          show: isCollectiveMode,
        },
        {
          label: "Contracts",
          href: "/settings/contracts",
          icon: <Handshake className="h-4 w-4" />,
          show: isCollectiveMode,
        },
        {
          label: "Payout",
          href: "/settings/payout",
          icon: <Handshake className="h-4 w-4" />,
          show: isCollectiveMode,
        },
        {
          label: "Monthly invoices",
          href: "/settings/invoices",
          icon: <Handshake className="h-4 w-4" />,
          show: isCollectiveMode,
        },
      ],
    },
    {
      title: "Studio",
      items: [
        {
          label: "Features",
          href: "/settings/features",
          icon: <Settings className="h-4 w-4" />,
        },
        {
          label: "Referral",
          href: "/settings/referral",
          icon: <Gift className="h-4 w-4" />,
        },
        {
          label: "Notifications",
          href: "/settings/notifications",
          icon: <Bell className="h-4 w-4" />,
        },
        {
          label: "Account",
          href: "/settings",
          icon: <Settings className="h-4 w-4" />,
        },
        {
          label: "Support",
          href: "/settings/support",
          icon: <HelpCircle className="h-4 w-4" />,
        },
      ],
    },
  ];

  // Filter by show flag
  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.show !== false),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Side nav */}
      <nav className="lg:w-56 flex-shrink-0">
        <div className="lg:sticky lg:top-6 space-y-5">
          {filteredGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== "/settings" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-brand-50 text-brand-700"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                    >
                      <span className={isActive ? "text-brand-600" : "text-gray-400"}>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Help link */}
          <div className="border-t border-gray-200 pt-4">
            <Link
              href="/help/settings/manage-feature-flags"
              className="flex items-center gap-2 px-3 text-xs text-gray-500 hover:text-brand-500 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Settings help
            </Link>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
