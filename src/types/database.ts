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
