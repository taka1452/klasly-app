-- ============================================
-- Klasly - Stripe Migration
-- Supabase SQL Editor でこのファイルの内容を実行してください
-- 既存テーブルにカラムを追加する形（テーブル再作成なし）
-- ============================================

-- ============================================
-- 1. studios テーブルに Stripe 関連カラムを追加
-- ============================================
ALTER TABLE studios
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'active';

COMMENT ON COLUMN studios.stripe_customer_id IS 'Stripe顧客ID（スタジオオーナー）';
COMMENT ON COLUMN studios.stripe_subscription_id IS 'StripeサブスクリプションID';
COMMENT ON COLUMN studios.plan_status IS 'プラン状態: active / past_due / cancelled';

-- ============================================
-- 2. members テーブルに Stripe 関連カラムを追加
-- ============================================
ALTER TABLE members
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

COMMENT ON COLUMN members.stripe_customer_id IS '会員のStripe顧客ID';

-- ============================================
-- 3. payments テーブル（既存）にカラムを追加
-- ============================================
-- 既存の payments には type, stripe_payment_intent_id, status などがある
-- stripe_invoice_id と payment_type を追加
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS payment_type TEXT;

COMMENT ON COLUMN payments.stripe_invoice_id IS 'Stripe Invoice ID（サブスクリプション請求用）';
COMMENT ON COLUMN payments.payment_type IS '支払い種別: subscription / class_pack / drop_in';

-- 既存カラムの型確認（payments 既存スキーマ）:
-- id, studio_id, member_id, amount, currency, type, status,
-- stripe_payment_intent_id, description, paid_at, due_date, created_at

-- ============================================
-- 4. RLS ポリシー（payments）
-- 既存の supabase_setup.sql で定義済みの場合はスキップ可能
-- ここでは owner/member の閲覧ポリシーを明示
-- ============================================

-- 既存ポリシーが存在する場合は DROP して再作成しない（既存のまま使用）
-- owner can view all payments（既存）
-- member can view own payments（既存）
-- owner can manage payments（既存）

-- ポリシーが未作成の場合のみ以下を実行:
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'owner can view all payments'
--   ) THEN
--     CREATE POLICY "owner can view all payments" ON payments FOR SELECT
--     USING (studio_id IN (SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'owner'));
--   END IF;
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'member can view own payments'
--   ) THEN
--     CREATE POLICY "member can view own payments" ON payments FOR SELECT
--     USING (member_id IN (SELECT id FROM members WHERE profile_id = auth.uid()));
--   END IF;
-- END $$;
