"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFeature } from "@/lib/features/feature-context";
import { FEATURE_KEYS } from "@/lib/features/feature-keys";
import type { ManagerPermissions } from "@/lib/auth/check-manager-permission";

type SidebarProps = {
  currentRole: string;
  studioName: string;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  showAdminLink?: boolean;
  isAlsoInstructor?: boolean;
  managerPermissions?: ManagerPermissions | null;
};

type NavItem = {
  label: string;
  href: string;
  dataTour?: string;
  featureKey?: string;
  group?: string;
  /** マネージャーに必要な権限キー。未指定なら全マネージャーに表示 */
  permissionKey?: keyof ManagerPermissions;
  icon: React.ReactNode;
};

const GROUP_LABELS: Record<string, string> = {
  people: "People",
  schedule: "Schedule",
  money: "Money",
  communication: "Communication",
};

const ownerNavItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    dataTour: undefined,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  // ── PEOPLE ──
  {
    label: "Members",
    href: "/members",
    dataTour: "members-section",
    group: "people",
    permissionKey: "can_manage_members",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    label: "Instructors",
    href: "/instructors",
    dataTour: undefined,
    group: "people",
    permissionKey: "can_manage_instructors",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    label: "Managers",
    href: "/managers",
    dataTour: undefined,
    group: "people",
    featureKey: FEATURE_KEYS.MANAGER_ROLE,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  // ── SCHEDULE ──
  {
    label: "Schedule",
    href: "/calendar",
    dataTour: undefined,
    group: "schedule",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: "Classes",
    href: "/classes",
    dataTour: undefined,
    group: "schedule",
    permissionKey: "can_manage_classes",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
      </svg>
    ),
  },
  {
    label: "Rooms",
    href: "/rooms",
    dataTour: undefined,
    group: "schedule",
    featureKey: FEATURE_KEYS.ROOM_MANAGEMENT,
    permissionKey: "can_manage_rooms",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  {
    label: "Events",
    href: "/events",
    dataTour: undefined,
    group: "schedule",
    featureKey: FEATURE_KEYS.RETREAT_BOOKING,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
      </svg>
    ),
  },
  {
    label: "Bookings",
    href: "/bookings",
    dataTour: "bookings-section",
    group: "schedule",
    permissionKey: "can_manage_bookings",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  // ── MONEY ──
  {
    label: "Payments",
    href: "/payments",
    dataTour: undefined,
    group: "money",
    permissionKey: "can_view_payments",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Passes",
    href: "/passes",
    dataTour: undefined,
    group: "money",
    featureKey: FEATURE_KEYS.STUDIO_PASS,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    ),
  },
  // ── COMMUNICATION ──
  {
    label: "Messages",
    href: "/messages",
    dataTour: undefined,
    group: "communication",
    featureKey: FEATURE_KEYS.MESSAGING,
    permissionKey: "can_send_messages",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
  {
    label: "Announcements",
    href: "/studio-announcements",
    dataTour: undefined,
    group: "communication",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
      </svg>
    ),
  },
  // ── UNGROUPED (bottom) ──
  {
    label: "Analytics",
    href: "/analytics",
    dataTour: undefined,
    featureKey: FEATURE_KEYS.UTM_TRACKING,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    dataTour: undefined,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

// マネージャーは Managers のみ除外（Settings は限定的にアクセス可能）
const managerNavItems = ownerNavItems.filter(
  (item) => item.href !== "/managers"
);

const myClassesNavItem: NavItem = {
  label: "My Classes",
  href: "/my-classes",
  dataTour: undefined,
  group: "schedule",
  icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
    </svg>
  ),
};

const myEarningsNavItem: NavItem = {
  label: "My Earnings",
  href: "/my-earnings",
  dataTour: undefined,
  group: "money",
  icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
};

/** Render a list of nav items with group section headers */
function NavList({
  items,
  pathname,
  onMobileClose,
}: {
  items: NavItem[];
  pathname: string;
  onMobileClose?: () => void;
}) {
  let lastGroup: string | undefined = undefined;

  return (
    <>
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));

        // Show group header when group changes
        let groupHeader: React.ReactNode = null;
        if (item.group && item.group !== lastGroup) {
          groupHeader = (
            <div
              key={`group-${item.group}`}
              className="px-3 pb-1 pt-4 first:pt-2"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {GROUP_LABELS[item.group] ?? item.group}
              </span>
            </div>
          );
        }
        // Reset when transitioning from grouped to ungrouped
        if (!item.group && lastGroup) {
          groupHeader = <div key="group-sep" className="my-2 border-t border-gray-100" />;
        }
        lastGroup = item.group;

        return (
          <div key={item.href}>
            {groupHeader}
            <Link
              href={item.href}
              onClick={onMobileClose}
              {...(item.dataTour ? { "data-tour": item.dataTour } : {})}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
          </div>
        );
      })}
    </>
  );
}

export default function Sidebar({
  currentRole,
  studioName,
  isMobileOpen = false,
  onMobileClose,
  showAdminLink = false,
  isAlsoInstructor = false,
  managerPermissions = null,
}: SidebarProps) {
  const pathname = usePathname();
  const { isEnabled } = useFeature();

  const baseItems = currentRole === "manager" ? managerNavItems : ownerNavItems;
  // Filter out nav items whose feature is disabled
  let navItems = baseItems.filter(
    (item) => !item.featureKey || isEnabled(item.featureKey)
  );
  // マネージャーの場合、権限に基づいてナビアイテムをフィルタリング
  if (currentRole === "manager" && managerPermissions) {
    navItems = navItems.filter(
      (item) => !item.permissionKey || managerPermissions[item.permissionKey]
    );
  }
  // オーナー/マネージャーがインストラクター兼任の場合、My Classes と My Earnings を挿入
  if (isAlsoInstructor && (currentRole === "owner" || currentRole === "manager")) {
    // My Classes を Classes の後に挿入
    const classesIdx = navItems.findIndex((item) => item.href === "/classes");
    if (classesIdx !== -1) {
      navItems = [
        ...navItems.slice(0, classesIdx + 1),
        myClassesNavItem,
        ...navItems.slice(classesIdx + 1),
      ];
    } else {
      const scheduleIdx = navItems.findIndex((item) => item.href === "/calendar");
      if (scheduleIdx !== -1) {
        navItems = [
          ...navItems.slice(0, scheduleIdx + 1),
          myClassesNavItem,
          ...navItems.slice(scheduleIdx + 1),
        ];
      } else {
        navItems = [...navItems, myClassesNavItem];
      }
    }
    // My Earnings を Payments の後に挿入
    const paymentsIdx = navItems.findIndex((item) => item.href === "/payments");
    if (paymentsIdx !== -1) {
      navItems = [
        ...navItems.slice(0, paymentsIdx + 1),
        myEarningsNavItem,
        ...navItems.slice(paymentsIdx + 1),
      ];
    } else {
      navItems = [...navItems, myEarningsNavItem];
    }
  }

  return (
    <>
      {/* モバイル: スライドインパネル */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-200 ease-out md:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold text-brand-700">Klasly</span>
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onMobileClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="border-b border-gray-200 px-6 py-3">
          <p className="truncate text-sm font-medium text-gray-900">{studioName}</p>
          <p className="text-xs text-gray-400 capitalize">{currentRole}</p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          <NavList items={navItems} pathname={pathname} onMobileClose={onMobileClose} />
        </nav>
        {showAdminLink && (
          <div className="border-t border-gray-200 px-6 py-3">
            <Link
              href="/admin"
              onClick={onMobileClose}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
            >
              <span aria-hidden>🔒</span>
              System Admin
            </Link>
          </div>
        )}
        <div className="border-t border-gray-200 px-6 py-4 space-y-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <Link href="/privacy" onClick={onMobileClose} className="text-gray-500 hover:text-gray-700">
              Privacy
            </Link>
            <Link href="/terms" onClick={onMobileClose} className="text-gray-500 hover:text-gray-700">
              Terms
            </Link>
          </div>
        </div>
      </aside>

      {/* デスクトップ: 固定サイドバー */}
      <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white md:flex">
      {/* ロゴ */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold text-brand-700">Klasly</span>
        </Link>
      </div>

      {/* スタジオ名 */}
      <div className="border-b border-gray-200 px-6 py-3">
        <p className="truncate text-sm font-medium text-gray-900">
          {studioName}
        </p>
        <p className="text-xs text-gray-400 capitalize">{currentRole}</p>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <NavList items={navItems} pathname={pathname} />
      </nav>

      {showAdminLink && (
        <div className="border-t border-gray-200 px-6 py-3">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
          >
            <span aria-hidden>🔒</span>
            System Admin
          </Link>
        </div>
      )}
      {/* フッター */}
      <div className="border-t border-gray-200 px-6 py-4 space-y-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <Link href="/privacy" className="text-gray-500 hover:text-gray-700">
            Privacy
          </Link>
          <Link href="/terms" className="text-gray-500 hover:text-gray-700">
            Terms
          </Link>
        </div>
      </div>
    </aside>
    </>
  );
}
