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
  // Admin
  admin_memo: string | null;
  /** true = デモ/テストスタジオ。KPI集計・スタジオ一覧からデフォルト除外 */
  is_demo: boolean;
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

export type Class = {
  id: string;
  studio_id: string;
  instructor_id: string | null;
  room_id: string | null;
  name: string;
  description: string | null;
  day_of_week: number; // 0=日 1=月 2=火 3=水 4=木 5=金 6=土
  start_time: string;
  duration_minutes: number;
  capacity: number;
  location: string | null;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
};

export type ClassSession = {
  id: string;
  studio_id: string;
  class_id: string;
  session_date: string;
  start_time: string;
  capacity: number;
  is_cancelled: boolean;
  notes: string | null;
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
  created_at: string;
  updated_at: string;
};

export type WaiverSignature = {
  id: string;
  member_id: string;
  sign_token: string;
  signed_name: string;
  signed_at: string | null;
  token_used: boolean;
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
  billing_interval: string | null;
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

export type ClassWithInstructor = Class & {
  instructors: Instructor & {
    profiles: Profile;
  };
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
  status: string;
  priority: string;
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
  status: string;
  payload: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
};

export type CronLog = {
  id: string;
  job_name: string;
  status: string;
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
  status: string;
  resend_id: string | null;
  error_message: string | null;
  created_at: string;
};

export type Coupon = {
  id: string;
  stripe_coupon_id: string;
  name: string;
  discount_type: string;
  discount_value: number;
  duration: string;
  duration_months: number | null;
  status: string;
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

export type StudioFeature = {
  id: string;
  studio_id: string;
  feature_key: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
