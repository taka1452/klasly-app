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
    target: "setup-checklist",
    title: "Your setup checklist",
    description:
      "These are the few steps that get your studio ready. Tick them off in any order — we'll keep this list visible until you're done.",
  },
  {
    target: "create-class-button",
    title: "Create your first class",
    description: "Add a recurring class so members have something to book.",
  },
  {
    target: "members-section",
    title: "Add members",
    description: "Invite or import the people who'll book classes with you.",
  },
  {
    target: "bookings-section",
    title: "Bookings",
    description: "Once members start booking, you'll find every reservation here.",
  },
  {
    target: "dashboard-stats",
    title: "Track performance",
    description: "Revenue, attendance, and today's classes — all at a glance.",
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
  href: string | null;
};

export function getSuccessCtaForRole(role: string): SuccessCta {
  if (role === "owner") {
    return { label: "Continue", href: null };
  }
  if (role === "instructor") {
    return { label: "View your schedule", href: "/instructor/schedule" };
  }
  if (role === "member") {
    return { label: "Book your first class", href: "/schedule" };
  }
  return { label: "Continue", href: "/" };
}
