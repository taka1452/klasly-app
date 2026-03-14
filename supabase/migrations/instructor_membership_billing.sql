-- ============================================
-- Instructor Membership Billing (Stripe)
-- instructor_memberships テーブルに Stripe 関連カラム追加
-- ============================================

-- Stripe サブスクリプション管理用カラム
ALTER TABLE public.instructor_memberships
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false;
