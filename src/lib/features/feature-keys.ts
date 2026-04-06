/**
 * Klasly Feature Flags
 *
 * Naming convention: category.feature_name (snake_case)
 *
 * When adding a new feature, add the key here
 * and set its default value in DEFAULT_FEATURES.
 */
export const FEATURE_KEYS = {
  // ============================================
  // Core features (shipped in earlier phases)
  // Default: true (all existing studios have access)
  // ============================================

  /** Member management (CRUD, CSV) */
  MEMBERS: "core.members",
  /** Class & session management */
  CLASSES: "core.classes",
  /** Booking management (capacity, waitlist) */
  BOOKINGS: "core.bookings",
  /** Attendance management (attendance, drop-in) */
  ATTENDANCE: "core.attendance",
  /** Stripe payment integration */
  PAYMENTS: "core.payments",
  /** Digital waiver */
  WAIVER: "core.waiver",
  /** In-app messaging */
  MESSAGING: "core.messaging",
  /** Instructor portal */
  INSTRUCTOR_PORTAL: "core.instructor_portal",
  /** CSV export / import */
  CSV: "core.csv",

  // ============================================
  // Collective Mode (Sarah model)
  // Default: false (must be explicitly enabled)
  // ============================================

  /** Instructor direct payout (Stripe Connect per instructor) */
  INSTRUCTOR_DIRECT_PAYOUT: "collective.instructor_direct_payout",
  /** Room / resource management */
  ROOM_MANAGEMENT: "collective.room_management",
  /** Instructor self-scheduling */
  INSTRUCTOR_SELF_SCHEDULING: "collective.instructor_self_scheduling",
  /** Instructor tier-based hour tracking */
  INSTRUCTOR_HOUR_TRACKING: "collective.instructor_hour_tracking",
  /** Instructor membership billing */
  INSTRUCTOR_BILLING: "collective.instructor_billing",
  /** Schedule public/private toggle */
  SCHEDULE_VISIBILITY: "collective.schedule_visibility",
  /** Manager role with custom permissions */
  MANAGER_ROLE: "collective.manager_role",

  // ============================================
  // Extensions
  // Default: false
  // ============================================

  /** WordPress embed widget */
  EMBED_WIDGET: "extension.embed_widget",
  /** Owner analytics dashboard */
  ANALYTICS: "extension.analytics",
  /** Custom form builder */
  CUSTOM_FORMS: "extension.custom_forms",
  /** Minor waiver */
  MINOR_WAIVER: "extension.minor_waiver",
  /** Retreat / event booking */
  RETREAT_BOOKING: "extension.retreat_booking",
  /** General Studio Pass */
  STUDIO_PASS: "extension.studio_pass",
  /** Enhanced PWA */
  PWA_ENHANCED: "extension.pwa_enhanced",
  /** UTM / link click tracking */
  UTM_TRACKING: "extension.utm_tracking",
  /** SOAP Notes for body therapists */
  SOAP_NOTES: "extension.soap_notes",
  /** Online class support (Zoom/Meet link) */
  ONLINE_CLASSES: "extension.online_classes",
  /** 1-on-1 appointment booking */
  APPOINTMENTS: "extension.appointments",
  /** Member favorites (classes + instructors) */
  MEMBER_FAVORITES: "extension.member_favorites",

  // ============================================
  // Payout Phase 3 features
  // Default: false (must be explicitly enabled)
  // ============================================

  /** Per-class fee override (Phase 3a) */
  CLASS_FEE_OVERRIDE: "payout.class_fee_override",
  /** Time-based fee schedules (Phase 3b) */
  FEE_SCHEDULES: "payout.fee_schedules",
  /** Instructor self-service invite link (Phase 3c) */
  INSTRUCTOR_INVITE_LINK: "payout.instructor_invite_link",
  /** Tax report / 1099 compliance (Phase 3d) */
  TAX_REPORT: "payout.tax_report",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

/**
 * Default values used when no record exists in studio_features.
 *
 * true  = enabled by default (existing features)
 * false = disabled by default (new features, must be explicitly enabled)
 */
export const DEFAULT_FEATURES: Record<FeatureKey, boolean> = {
  // Core: default ON
  [FEATURE_KEYS.MEMBERS]: true,
  [FEATURE_KEYS.CLASSES]: true,
  [FEATURE_KEYS.BOOKINGS]: true,
  [FEATURE_KEYS.ATTENDANCE]: true,
  [FEATURE_KEYS.PAYMENTS]: true,
  [FEATURE_KEYS.WAIVER]: true,
  [FEATURE_KEYS.MESSAGING]: true,
  [FEATURE_KEYS.INSTRUCTOR_PORTAL]: true,
  [FEATURE_KEYS.CSV]: true,

  // Collective Mode: default OFF
  [FEATURE_KEYS.INSTRUCTOR_DIRECT_PAYOUT]: false,
  [FEATURE_KEYS.ROOM_MANAGEMENT]: false,
  [FEATURE_KEYS.INSTRUCTOR_SELF_SCHEDULING]: false,
  [FEATURE_KEYS.INSTRUCTOR_HOUR_TRACKING]: false,
  [FEATURE_KEYS.INSTRUCTOR_BILLING]: false,
  [FEATURE_KEYS.SCHEDULE_VISIBILITY]: false,
  [FEATURE_KEYS.MANAGER_ROLE]: false,

  // Extensions: default OFF
  [FEATURE_KEYS.EMBED_WIDGET]: false,
  [FEATURE_KEYS.ANALYTICS]: false,
  [FEATURE_KEYS.CUSTOM_FORMS]: false,
  [FEATURE_KEYS.MINOR_WAIVER]: false,
  [FEATURE_KEYS.RETREAT_BOOKING]: false,
  [FEATURE_KEYS.STUDIO_PASS]: false,
  [FEATURE_KEYS.PWA_ENHANCED]: false,
  [FEATURE_KEYS.UTM_TRACKING]: false,
  [FEATURE_KEYS.SOAP_NOTES]: false,
  [FEATURE_KEYS.ONLINE_CLASSES]: false,
  [FEATURE_KEYS.APPOINTMENTS]: false,
  [FEATURE_KEYS.MEMBER_FAVORITES]: false,

  // Payout Phase 3: default OFF
  [FEATURE_KEYS.CLASS_FEE_OVERRIDE]: false,
  [FEATURE_KEYS.FEE_SCHEDULES]: false,
  [FEATURE_KEYS.INSTRUCTOR_INVITE_LINK]: false,
  [FEATURE_KEYS.TAX_REPORT]: false,
};

/**
 * Human-readable labels for each feature key, grouped by category.
 */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  [FEATURE_KEYS.MEMBERS]: "Members",
  [FEATURE_KEYS.CLASSES]: "Classes",
  [FEATURE_KEYS.BOOKINGS]: "Bookings",
  [FEATURE_KEYS.ATTENDANCE]: "Attendance",
  [FEATURE_KEYS.PAYMENTS]: "Payments",
  [FEATURE_KEYS.WAIVER]: "Waiver",
  [FEATURE_KEYS.MESSAGING]: "Messaging",
  [FEATURE_KEYS.INSTRUCTOR_PORTAL]: "Instructor Portal",
  [FEATURE_KEYS.CSV]: "CSV Export / Import",

  [FEATURE_KEYS.INSTRUCTOR_DIRECT_PAYOUT]: "Instructor Direct Payout",
  [FEATURE_KEYS.ROOM_MANAGEMENT]: "Room Management",
  [FEATURE_KEYS.INSTRUCTOR_SELF_SCHEDULING]: "Instructor Self-Scheduling",
  [FEATURE_KEYS.INSTRUCTOR_HOUR_TRACKING]: "Hour Tracking",
  [FEATURE_KEYS.INSTRUCTOR_BILLING]: "Instructor Billing",
  [FEATURE_KEYS.SCHEDULE_VISIBILITY]: "Schedule Visibility",
  [FEATURE_KEYS.MANAGER_ROLE]: "Manager Role",

  [FEATURE_KEYS.EMBED_WIDGET]: "Embed Widget",
  [FEATURE_KEYS.ANALYTICS]: "Analytics",
  [FEATURE_KEYS.CUSTOM_FORMS]: "Custom Forms",
  [FEATURE_KEYS.MINOR_WAIVER]: "Minor Waiver",
  [FEATURE_KEYS.RETREAT_BOOKING]: "Retreat Booking",
  [FEATURE_KEYS.STUDIO_PASS]: "Studio Pass",
  [FEATURE_KEYS.PWA_ENHANCED]: "PWA Enhanced",
  [FEATURE_KEYS.UTM_TRACKING]: "UTM Tracking",
  [FEATURE_KEYS.SOAP_NOTES]: "SOAP Notes",
  [FEATURE_KEYS.ONLINE_CLASSES]: "Online Classes",
  [FEATURE_KEYS.APPOINTMENTS]: "Appointments",
  [FEATURE_KEYS.MEMBER_FAVORITES]: "Member Favorites",

  [FEATURE_KEYS.CLASS_FEE_OVERRIDE]: "Class Fee Override",
  [FEATURE_KEYS.FEE_SCHEDULES]: "Fee Schedules",
  [FEATURE_KEYS.INSTRUCTOR_INVITE_LINK]: "Instructor Invite Link",
  [FEATURE_KEYS.TAX_REPORT]: "Tax Report",
};

/** Category groupings for the admin UI */
export const FEATURE_CATEGORIES = {
  core: {
    label: "Core Features",
    keys: [
      FEATURE_KEYS.MEMBERS,
      FEATURE_KEYS.CLASSES,
      FEATURE_KEYS.BOOKINGS,
      FEATURE_KEYS.ATTENDANCE,
      FEATURE_KEYS.PAYMENTS,
      FEATURE_KEYS.WAIVER,
      FEATURE_KEYS.MESSAGING,
      FEATURE_KEYS.INSTRUCTOR_PORTAL,
      FEATURE_KEYS.CSV,
    ],
  },
  collective: {
    label: "Collective Mode",
    keys: [
      FEATURE_KEYS.INSTRUCTOR_DIRECT_PAYOUT,
      FEATURE_KEYS.ROOM_MANAGEMENT,
      FEATURE_KEYS.INSTRUCTOR_SELF_SCHEDULING,
      FEATURE_KEYS.INSTRUCTOR_HOUR_TRACKING,
      FEATURE_KEYS.INSTRUCTOR_BILLING,
      FEATURE_KEYS.SCHEDULE_VISIBILITY,
      FEATURE_KEYS.MANAGER_ROLE,
    ],
  },
  extension: {
    label: "Extensions",
    keys: [
      FEATURE_KEYS.EMBED_WIDGET,
      FEATURE_KEYS.ANALYTICS,
      FEATURE_KEYS.CUSTOM_FORMS,
      FEATURE_KEYS.MINOR_WAIVER,
      FEATURE_KEYS.RETREAT_BOOKING,
      FEATURE_KEYS.STUDIO_PASS,
      FEATURE_KEYS.PWA_ENHANCED,
      FEATURE_KEYS.UTM_TRACKING,
      FEATURE_KEYS.SOAP_NOTES,
      FEATURE_KEYS.ONLINE_CLASSES,
      FEATURE_KEYS.APPOINTMENTS,
      FEATURE_KEYS.MEMBER_FAVORITES,
    ],
  },
  payout: {
    label: "Payout (Phase 3)",
    keys: [
      FEATURE_KEYS.CLASS_FEE_OVERRIDE,
      FEATURE_KEYS.FEE_SCHEDULES,
      FEATURE_KEYS.INSTRUCTOR_INVITE_LINK,
      FEATURE_KEYS.TAX_REPORT,
    ],
  },
} as const;
