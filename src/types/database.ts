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
  plan: "free" | "studio" | "grow";
  max_members: number;
  created_at: string;
};

export type Profile = {
  id: string;
  studio_id: string | null;
  role: "owner" | "instructor" | "member";
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Member = {
  id: string;
  studio_id: string;
  profile_id: string;
  plan_type: "monthly" | "pack" | "drop_in";
  credits: number; // -1 = 月額プラン
  status: "active" | "paused" | "cancelled";
  joined_at: string;
  notes: string | null;
  created_at: string;
};

export type Instructor = {
  id: string;
  studio_id: string;
  profile_id: string;
  bio: string | null;
  specialties: string[] | null;
  created_at: string;
};

export type Class = {
  id: string;
  studio_id: string;
  instructor_id: string | null;
  name: string;
  description: string | null;
  day_of_week: number; // 0=日 1=月 2=火 3=水 4=木 5=金 6=土
  start_time: string;
  duration_minutes: number;
  capacity: number;
  location: string | null;
  is_active: boolean;
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

export type Payment = {
  id: string;
  studio_id: string;
  member_id: string;
  amount: number; // セント単位
  currency: string;
  type: "monthly" | "pack" | "drop_in";
  status: "pending" | "paid" | "failed" | "refunded";
  stripe_payment_intent_id: string | null;
  description: string | null;
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
