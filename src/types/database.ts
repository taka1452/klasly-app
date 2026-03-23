// ============================================
// Klasly - Database Types
// Supabase のテーブル構造に対応する型定義
// ============================================

export type Studio = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  plan: string; // 'pro'（旧: free/studio/grow）
  plan_status: string; // trialing / active / past_due / grace / canceled
  max_members: number;
  // Stripe連携
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  // Stripe Connect（メンバー決済用）
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean;
  // 課金管理
  trial_ends_at: string | null;
  subscription_period: string | null; // monthly / yearly
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_period_ends_at: string | null;
  trial_reminder_sent: boolean;
  email_notifications_enabled: boolean;
  /**
   * 予約時にクレジットを要求するか
   * null = 自動判定（stripe_connect_onboarding_complete が true なら必須）
   * true = 常に必須（手動 ON）
   * false = 常に不要（現金スタジオなど）
   */
  booking_requires_credits: boolean | null;
  // スタジオ料金設定（会員向け）
  // @deprecated products テーブルに移行済み。互換のためDBには残すが新規コードでは products を参照すること。
  drop_in_price?: number | null;
  pack_5_price?: number | null;
  pack_10_price?: number | null;
  monthly_price?: number | null;
  // Instructor Direct Payout
  /** 支払いモデル: 'studio'（既存）/ 'instructor_direct'（インストラクター直接支払い） */
  payout_model: "studio" | "instructor_direct";
  /** スタジオ取り分（%）: 例 20.0 = 20% */
  studio_fee_percentage: number;
  /** スタジオ手数料タイプ: 'percentage' | 'fixed' */
  studio_fee_type: "percentage" | "fixed";
  /** スタジオのタイムゾーン */
  timezone: string;
  // Admin
  admin_memo: string | null;
  /** true = デモ/テストスタジオ。KPI集計・スタジオ一覧からデフォルト除外 */
  is_demo: boolean;
  /** セッション自動生成の週数（デフォルト8） */
  session_generation_weeks: number;
  /** サインアップ時のリファーラルコード。NULLなら紹介なし */
  referred_by_code: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  studio_id: string | null;
  role: "owner" | "instructor" | "member" | "manager";
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  onboarding_started_at: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
};

export type Member = {
  id: string;
  studio_id: string;
  profile_id: string;
  plan_type: "monthly" | "pack" | "drop_in" | "subscription";
  credits: number;
  status: "active" | "paused" | "cancelled";
  joined_at: string;
  notes: string | null;
  created_at: string;
  // Stripe連携
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  /** Stripe Connect 経由の決済用（Connected Account 側の顧客 ID） */
  stripe_connect_customer_id: string | null;
  // Waiver
  waiver_signed: boolean;
  waiver_signed_at: string | null;
  // Minor
  is_minor: boolean;
  date_of_birth: string | null;
  guardian_email: string | null;
};

export type Instructor = {
  id: string;
  studio_id: string;
  profile_id: string;
  bio: string | null;
  specialties: string[] | null;
  /** Stripe Connect アカウントID（インストラクター直接支払い用） */
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  /** レンタル契約タイプ */
  rental_type: "none" | "flat_monthly" | "per_class";
  /** レンタル料（cents） */
  rental_amount: number;
  created_at: string;
};

export type Manager = {
  id: string;
  studio_id: string;
  profile_id: string;
  can_manage_members: boolean;
  can_manage_classes: boolean;
  can_manage_instructors: boolean;
  can_manage_bookings: boolean;
  can_manage_rooms: boolean;
  can_view_payments: boolean;
  can_send_messages: boolean;
  can_teach: boolean;
  created_at: string;
};

export type Room = {
  id: string;
  studio_id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  is_active: boolean;
  created_at: string;
};

// ============================================
// クラステンプレート + 統合セッション
// ============================================

export type ClassTemplate = {
  id: string;
  studio_id: string;
  instructor_id: string | null;
  name: string;
  description: string | null;
  duration_minutes: number;
  capacity: number;
  price_cents: number | null;
  location: string | null;
  class_type: "in_person" | "online" | "hybrid";
  online_link: string | null;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
};

/** @deprecated Use ClassTemplate instead. Kept for migration compatibility. */
export type Class = {
  id: string;
  studio_id: string;
  instructor_id: string | null;
  room_id: string | null;
  name: string;
  description: string | null;
  day_of_week: number | null; // 0=日 1=月 2=火 3=水 4=木 5=金 6=土 (NULL for one_time)
  start_time: string;
  duration_minutes: number;
  capacity: number;
  location: string | null;
  is_active: boolean;
  is_public: boolean;
  /** Per-class price in cents. NULL = use studio product pricing (Studio Mode). */
  price_cents: number | null;
  is_online: boolean;
  online_link: string | null;
  schedule_type: "recurring" | "one_time";
  one_time_date: string | null;
  created_at: string;
};

export type ClassSession = {
  id: string;
  studio_id: string;
  /** @deprecated Use template_id instead */
  class_id: string | null;
  /** テンプレートID（NULL = room_only） */
  template_id: string | null;
  /** 部屋ID（NULL = オンライン/外部会場） */
  room_id: string | null;
  /** インストラクターID */
  instructor_id: string | null;
  session_date: string;
  start_time: string;
  /** 終了時間 */
  end_time: string | null;
  /** セッション時間（分） */
  duration_minutes: number | null;
  capacity: number;
  is_cancelled: boolean;
  is_public: boolean;
  /** @deprecated class_typeで判定 */
  is_online: boolean | null;
  online_link: string | null;
  notes: string | null;
  /** セッション単位の表示名（room_only用） */
  title: string | null;
  /** 'class' | 'room_only' */
  session_type: "class" | "room_only";
  /** セッション単位の価格override（cents） */
  price_cents: number | null;
  /** 外部会場名 */
  location: string | null;
  /** 繰り返しグループID */
  recurrence_group_id: string | null;
  /** 繰り返しルール */
  recurrence_rule: "weekly" | null;
  created_at: string;
};

export type Booking = {
  id: string;
  studio_id: string;
  session_id: string;
  member_id: string;
  status: "confirmed" | "cancelled" | "waitlist";
  attended: boolean;
  credit_deducted?: boolean;
  booked_via_pass: boolean;
  created_at: string;
};

export type DropInAttendance = {
  id: string;
  studio_id: string;
  session_id: string;
  member_id: string;
  attended_at: string;
  credit_deducted: boolean;
  notes: string | null;
  created_at: string;
};

export type WaiverTemplate = {
  id: string;
  studio_id: string;
  title: string;
  content: string;
  /** Waiver種別 */
  waiver_type: "standard" | "minor";
  created_at: string;
  updated_at: string;
};

export type WaiverSignature = {
  id: string;
  member_id: string;
  studio_id: string;
  template_id: string;
  sign_token: string;
  signed_name: string;
  signed_at: string | null;
  token_used: boolean;
  // Minor Waiver
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_relationship: "parent" | "legal_guardian" | null;
  is_minor: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  studio_id: string;
  name: string;
  type: "one_time" | "subscription";
  credits: number;
  price: number;
  currency: string;
  billing_interval: "month" | "year" | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  studio_id: string;
  member_id: string | null;
  product_id: string | null;
  amount: number; // セント単位
  currency: string;
  type: "monthly" | "pack" | "drop_in" | "product_purchase";
  status: "pending" | "paid" | "failed" | "refunded";
  stripe_payment_intent_id: string | null;
  description: string | null;
  payment_type: string | null;
  paid_at: string | null;
  due_date: string | null;
  created_at: string;
};

// ============================================
// リレーション付きの型（JOINした結果用）
// ============================================

export type MemberWithProfile = Member & {
  profiles: Profile;
};

/** @deprecated Use ClassTemplateWithInstructor */
export type ClassWithInstructor = Class & {
  instructors: Instructor & {
    profiles: Profile;
  };
};

export type ClassTemplateWithInstructor = ClassTemplate & {
  instructors: (Instructor & {
    profiles: Profile;
  }) | null;
};

export type BookingWithDetails = Booking & {
  members: MemberWithProfile;
  class_sessions: ClassSession & {
    classes: Class;
  };
};

// ============================================
// Admin / クーポン / サポート
// ============================================

export type AdminNote = {
  id: string;
  studio_id: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type SupportTicket = {
  id: string;
  ticket_number: number;
  studio_id: string | null;
  subject: string;
  description: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type SupportTicketComment = {
  id: string;
  ticket_id: string;
  content: string;
  created_by: string;
  created_at: string;
};

export type WebhookLog = {
  id: string;
  event_type: string;
  event_id: string | null;
  studio_id: string | null;
  status: "success" | "error" | "failure" | "partial";
  payload: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
};

export type CronLog = {
  id: string;
  job_name: string;
  status: "success" | "error" | "failure" | "partial" | "running";
  affected_count: number;
  details: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

export type EmailLog = {
  id: string;
  studio_id: string | null;
  to_email: string;
  template: string;
  subject: string | null;
  status: "success" | "error" | "sent" | "failed";
  resend_id: string | null;
  error_message: string | null;
  created_at: string;
};

export type Coupon = {
  id: string;
  stripe_coupon_id: string;
  name: string;
  discount_type: "percent" | "amount";
  discount_value: number;
  duration: "once" | "repeating" | "forever";
  duration_months: number | null;
  status: "active" | "inactive";
  notes: string | null;
  created_by: string;
  created_at: string;
};

export type PromotionCode = {
  id: string;
  coupon_id: string;
  stripe_promo_id: string;
  code: string;
  max_redemptions: number | null;
  times_redeemed: number;
  expires_at: string | null;
  first_time_only: boolean;
  is_active: boolean;
  created_at: string;
};

export type CouponRedemption = {
  id: string;
  studio_id: string;
  coupon_id: string;
  promotion_code_id: string | null;
  stripe_subscription_id: string | null;
  redeemed_at: string;
};

/** Admin で管理するプラットフォーム設定（platform_settings テーブル） */
export type PlatformSetting = {
  key: string;
  value: string;
  updated_at: string;
};

// ============================================
// メッセージング
// ============================================

export type Message = {
  id: string;
  studio_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

/** 送受信者プロフィール付き */
export type MessageWithProfiles = Message & {
  sender: Pick<Profile, "id" | "full_name" | "email" | "role">;
  recipient: Pick<Profile, "id" | "full_name" | "email" | "role">;
};

/** オーナー視点: メンバーごとの会話サマリ */
export type ConversationSummary = {
  memberId: string;    // profiles.id (メンバー)
  memberName: string;
  memberEmail: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

// ============================================
// インストラクター収益
// ============================================

export type InstructorEarning = {
  id: string;
  studio_id: string;
  instructor_id: string;
  session_id: string | null;
  booking_id: string | null;
  gross_amount: number;       // 生徒の支払い額（cents）
  stripe_fee: number;         // Stripe手数料（cents）
  platform_fee: number;       // Klasly手数料（cents）
  studio_fee: number;         // スタジオ取り分（cents）
  instructor_payout: number;  // インストラクター受取額（cents）
  studio_fee_percentage: number;
  /** 手数料タイプ: 'percentage' | 'fixed' */
  fee_type: "percentage" | "fixed";
  /** 手数料ソース: どのルールで料金が決定されたか */
  fee_source: "studio_default" | "instructor_override" | "class_override" | "fee_schedule";
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  status: "pending" | "completed" | "failed";
  created_at: string;
};

export type InstructorFeeOverride = {
  id: string;
  studio_id: string;
  instructor_id: string;
  fee_type: "percentage" | "fixed";
  fee_value: number;
  created_at: string;
  updated_at: string;
};

export type InstructorRoomBooking = {
  id: string;
  studio_id: string;
  instructor_id: string;
  room_id: string;
  title: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: "confirmed" | "cancelled";
  is_public: boolean;
  notes: string | null;
  recurrence_group_id: string | null;
  day_of_week: number | null;
  created_at: string;
};

export type InstructorMembershipTier = {
  id: string;
  studio_id: string;
  name: string;
  monthly_minutes: number; // -1 = unlimited
  monthly_price: number;   // cents
  is_active: boolean;
  sort_order: number;
  overage_rate_cents: number | null; // cents per hour, null = no overage billing
  allow_overage: boolean; // false = block scheduling at limit
  created_at: string;
};

export type InstructorMembership = {
  id: string;
  studio_id: string;
  instructor_id: string;
  tier_id: string;
  status: "active" | "cancelled";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  started_at: string;
  created_at: string;
};

export type InstructorOverageCharge = {
  id: string;
  studio_id: string;
  instructor_id: string;
  period_start: string;
  period_end: string;
  tier_name: string;
  included_minutes: number;
  used_minutes: number;
  overage_minutes: number;
  overage_rate_cents: number;
  total_charge_cents: number;
  stripe_payment_intent_id: string | null;
  status: "pending" | "charged" | "failed" | "waived";
  waived_by: string | null;
  waived_reason: string | null;
  created_at: string;
};

export type ClassFeeOverride = {
  id: string;
  studio_id: string;
  class_id: string;
  fee_type: "percentage" | "fixed";
  fee_value: number;
  created_at: string;
  updated_at: string;
};

export type FeeSchedule = {
  id: string;
  studio_id: string;
  name: string;
  day_of_week: number[] | null;
  start_time: string;
  end_time: string;
  fee_type: "percentage" | "fixed";
  fee_value: number;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InstructorInviteToken = {
  id: string;
  studio_id: string;
  token: string;
  invite_role: "instructor" | "manager";
  expires_at: string;
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
};

// ============================================
// アップデート通知
// ============================================

export type Announcement = {
  id: string;
  title: string;
  body: string;
  target_roles: string[];
  is_active: boolean;
  published_at: string;
  created_at: string;
};

export type AnnouncementRead = {
  id: string;
  announcement_id: string;
  profile_id: string;
  read_at: string;
};

// ============================================
// リンクトラッキング（UTM）
// ============================================

export type LinkClick = {
  id: string;
  studio_id: string;
  url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  created_at: string;
};

// ============================================
// SOAP Notes（施術記録）
// ============================================

export type SOAPNote = {
  id: string;
  studio_id: string;
  instructor_id: string | null;
  member_id: string;
  session_id: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  session_date: string;
  is_confidential: boolean;
  created_at: string;
  updated_at: string;
};

export type StudioFeature = {
  id: string;
  studio_id: string;
  feature_key: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Events & Retreats
// ============================================================

export type CancellationPolicyTier = {
  days_before: number;
  refund_percent: number;
  fee_cents: number;
  note: string;
};

export type ApplicationFieldType = "text" | "email" | "textarea" | "select" | "radio" | "checkbox" | "number" | "date";

export type ApplicationField = {
  id: string;
  label: string;
  type: ApplicationFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
};

export type EventStatus = "draft" | "published" | "sold_out" | "completed" | "cancelled";
export type EventPaymentType = "full" | "installment";
export type EventBookingStatus = "pending_payment" | "confirmed" | "completed" | "cancelled";
export type EventPaymentStatus = "unpaid" | "partial" | "fully_paid" | "refunded";
export type InstallmentStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled";

export type Event = {
  id: string;
  studio_id: string;
  instructor_id: string | null;
  name: string;
  description: string | null;
  location_name: string | null;
  location_address: string | null;
  start_date: string;
  end_date: string;
  image_url: string | null;
  status: EventStatus;
  is_public: boolean;
  payment_type: EventPaymentType;
  installment_count: number;
  cancellation_policy: CancellationPolicyTier[];
  cancellation_policy_text: string | null;
  max_total_capacity: number | null;
  custom_form_id: string | null;
  /** カスタム申込フォームフィールド定義 */
  application_fields: ApplicationField[] | null;
  created_at: string;
  updated_at: string;
};

export type EventOption = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  capacity: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type EventBooking = {
  id: string;
  event_id: string;
  event_option_id: string | null;
  member_id: string | null;
  guest_name: string | null;
  guest_email: string;
  guest_phone: string | null;
  booking_status: EventBookingStatus;
  total_amount_cents: number;
  payment_type: EventPaymentType;
  payment_status: EventPaymentStatus;
  form_response_id: string | null;
  /** カスタム申込フォームへの回答データ */
  application_responses: Record<string, string | boolean> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EventPaymentSchedule = {
  id: string;
  event_booking_id: string;
  installment_number: number;
  amount_cents: number;
  due_date: string;
  stripe_payment_intent_id: string | null;
  stripe_payment_method_id: string | null;
  status: InstallmentStatus;
  paid_at: string | null;
  created_at: string;
};

// ---- Studio Pass ----

export type StudioPass = {
  id: string;
  studio_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  billing_interval: "month" | "year";
  max_classes_per_month: number | null;
  auto_distribute: boolean;
  stripe_price_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type PassSubscription = {
  id: string;
  studio_pass_id: string;
  member_id: string;
  stripe_subscription_id: string | null;
  status: "active" | "cancelled" | "past_due";
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  classes_used_this_period: number;
  created_at: string;
};

export type PassClassUsage = {
  id: string;
  pass_subscription_id: string;
  session_id: string;
  instructor_id: string;
  used_at: string;
};

export type PassDistribution = {
  id: string;
  studio_id: string;
  studio_pass_id: string;
  instructor_id: string;
  period_start: string;
  period_end: string;
  total_classes: number;
  total_pool_classes: number;
  gross_pool_amount: number;
  payout_amount: number;
  stripe_transfer_id: string | null;
  status: "pending" | "approved" | "processing" | "completed" | "failed";
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
};

// ============================================
// リファーラル
// ============================================

export type ReferralCode = {
  id: string;
  studio_id: string;
  code: string;
  created_at: string;
};

export type ReferralReward = {
  id: string;
  referrer_studio_id: string;
  referred_studio_id: string;
  status: 'pending' | 'completed' | 'expired';
  referrer_reward_applied: boolean;
  referred_reward_applied: boolean;
  stripe_coupon_id_referrer: string | null;
  stripe_coupon_id_referred: string | null;
  completed_at: string | null;
  created_at: string;
};

// ============================================
// Push Notifications
// ============================================

export type PushSubscription = {
  id: string;
  profile_id: string;
  studio_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  device_name: string | null;
  is_active: boolean;
  last_used_at: string;
  failed_count: number;
  created_at: string;
  updated_at: string;
};

export type NotificationPreferences = {
  id: string;
  profile_id: string;
  studio_id: string | null;
  booking_confirmation: boolean;
  booking_cancellation: boolean;
  class_reminder: boolean;
  waitlist_promotion: boolean;
  new_message: boolean;
  studio_announcement: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type EmailNotificationPreferences = {
  id: string;
  profile_id: string;
  studio_id: string;
  email_booking_confirmation: boolean;
  email_booking_cancellation: boolean;
  email_class_changes: boolean;
  email_payment_receipts: boolean;
  email_waiver_requests: boolean;
  email_new_messages: boolean;
  email_waitlist_promotion: boolean;
  email_event_reminders: boolean;
  created_at: string;
  updated_at: string;
};

export type PushNotificationType =
  | "booking_confirmation"
  | "booking_cancellation"
  | "class_reminder"
  | "waitlist_promotion"
  | "new_message"
  | "studio_announcement";
