export type ActivitySeverity = "critical" | "warning" | "info" | "success";

export type ActivityCategory =
  | "booking"
  | "billing"
  | "operations"
  | "member"
  | "announcement"
  | "alert";

export type ActivityRole = "owner" | "manager" | "instructor" | "member";

export interface ActivityEventScope {
  memberId?: string | null;
  instructorId?: string | null;
  sessionId?: string | null;
  templateId?: string | null;
}

export interface ActivityEvent {
  id: string;
  category: ActivityCategory;
  severity: ActivitySeverity;
  title: string;
  subtitle?: string;
  occurredAt: string;
  unread?: boolean;
  actionRequired?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  scope?: ActivityEventScope;
}

export interface AlertThresholds {
  inactive_member_days: number;
  no_show_streak: number;
  unpaid_grace_days: number;
  waiver_unsigned_after_days: number;
  cancellation_rate_threshold: number;
  follow_up_after_days: number;
  contract_stuck_days: number;
  tier_limit_warning_pct: number;
}

export interface DisplayPrefs {
  hide_read: boolean;
  default_tab: "all" | ActivityCategory;
}

export interface ManagerPerms {
  can_manage_members?: boolean;
  can_manage_classes?: boolean;
  can_manage_bookings?: boolean;
  can_manage_rooms?: boolean;
  can_view_payments?: boolean;
  can_send_messages?: boolean;
  can_manage_settings?: boolean;
}
