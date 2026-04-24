/** Shared types for the analytics report builder. */
export type ReportType =
  | "revenue_over_time"
  | "class_attendance"
  | "instructor_payouts"
  | "member_growth"
  | "drop_in_counts"
  | "room_utilization";

export type DateRangePreset =
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_month"
  | "last_month"
  | "ytd"
  | "custom";

export type GroupBy = "day" | "week" | "month";

export type ReportFilters = {
  date_range?: DateRangePreset;
  date_from?: string; // YYYY-MM-DD
  date_to?: string;
  instructor_id?: string;
  class_template_id?: string;
  group_by?: GroupBy;
};

/** Flat chart-ready shape: one row per X point. */
export type ReportPoint = {
  label: string;
  /** Primary series (numeric). */
  value: number;
  /** Optional secondary series for two-line / grouped charts. */
  value2?: number;
  /** Optional raw row for display in a companion table. */
  meta?: Record<string, unknown>;
};

export type ReportResult = {
  report_type: ReportType;
  filters: ReportFilters;
  chart: {
    kind: "bar" | "line" | "area" | "pie";
    xLabel: string;
    yLabel: string;
    series: string[]; // ["Revenue"], ["Attendance", "Capacity"]
    points: ReportPoint[];
  };
  summary: Array<{ label: string; value: string; delta?: string }>;
};

export const REPORT_TYPE_META: Record<
  ReportType,
  { label: string; description: string; defaultGroupBy: GroupBy }
> = {
  revenue_over_time: {
    label: "Revenue over time",
    description: "Total paid member payments bucketed by day/week/month.",
    defaultGroupBy: "day",
  },
  class_attendance: {
    label: "Class attendance",
    description: "Confirmed bookings & capacity per class session.",
    defaultGroupBy: "week",
  },
  instructor_payouts: {
    label: "Instructor payouts",
    description: "Monthly instructor invoice totals (tier + overage + flat).",
    defaultGroupBy: "month",
  },
  member_growth: {
    label: "Member growth",
    description: "New members joined per period vs. active member count.",
    defaultGroupBy: "week",
  },
  drop_in_counts: {
    label: "Drop-in counts",
    description: "Drop-in attendances per period.",
    defaultGroupBy: "week",
  },
  room_utilization: {
    label: "Room utilization",
    description: "Booked minutes per room for the period.",
    defaultGroupBy: "week",
  },
};
