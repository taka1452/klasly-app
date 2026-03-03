/**
 * Role-based onboarding tour steps.
 * Target values must match data-tour attributes on DOM elements.
 */
export type TourStep = {
  target: string;
  title: string;
  description: string;
};

export const OWNER_STEPS: TourStep[] = [
  {
    target: "create-class-button",
    title: "Create Your First Class",
    description: "Start by creating a class your members can book.",
  },
  {
    target: "members-section",
    title: "Add Members",
    description: "Manage your members here.",
  },
  {
    target: "bookings-section",
    title: "Bookings",
    description: "Members can reserve classes here.",
  },
  {
    target: "dashboard-stats",
    title: "Track Performance",
    description: "Monitor attendance and revenue.",
  },
];

export const INSTRUCTOR_STEPS: TourStep[] = [
  {
    target: "assigned-classes",
    title: "Your Classes",
    description: "View the classes assigned to you.",
  },
  {
    target: "attendance-section",
    title: "Attendance",
    description: "Manage attendance for each session.",
  },
];

export const MEMBER_STEPS: TourStep[] = [
  {
    target: "available-classes",
    title: "Available Classes",
    description: "Browse upcoming classes you can book.",
  },
  {
    target: "booking-button",
    title: "Book a Class",
    description: "Click to reserve your spot.",
  },
  {
    target: "my-bookings",
    title: "My Bookings",
    description: "View and manage your booked classes.",
  },
];

export function getStepsForRole(role: string): TourStep[] {
  if (role === "owner") return OWNER_STEPS;
  if (role === "instructor") return INSTRUCTOR_STEPS;
  if (role === "member") return MEMBER_STEPS;
  return [];
}

export type SuccessCta = {
  label: string;
  href: string;
};

export function getSuccessCtaForRole(role: string): SuccessCta {
  if (role === "owner") {
    return { label: "Create your first real class", href: "/classes/new" };
  }
  if (role === "instructor") {
    return { label: "View your schedule", href: "/instructor/schedule" };
  }
  if (role === "member") {
    return { label: "Book your first class", href: "/schedule" };
  }
  return { label: "Continue", href: "/" };
}
