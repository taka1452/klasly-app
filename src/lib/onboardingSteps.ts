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

export function getStepsForRole(role: string): TourStep[] {
  if (role === "owner") return OWNER_STEPS;
  if (role === "instructor") return INSTRUCTOR_STEPS;
  return [];
}
