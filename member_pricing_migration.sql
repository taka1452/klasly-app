-- ============================================
-- Klasly - 会員料金設定 Migration
-- Supabase SQL Editor でこのファイルの内容を実行してください
-- ============================================
-- オーナーがスタジオ設定で料金を設定できるようにする
-- 金額はセント単位（$20 = 2000, $80 = 8000, $150 = 15000, $120 = 12000）
-- ============================================

ALTER TABLE studios
ADD COLUMN IF NOT EXISTS drop_in_price INTEGER DEFAULT 2000,
ADD COLUMN IF NOT EXISTS pack_5_price INTEGER DEFAULT 8000,
ADD COLUMN IF NOT EXISTS pack_10_price INTEGER DEFAULT 15000,
ADD COLUMN IF NOT EXISTS monthly_price INTEGER DEFAULT 12000;

COMMENT ON COLUMN studios.drop_in_price IS 'Drop-in 1回あたり料金（セント）';
COMMENT ON COLUMN studios.pack_5_price IS '5回券料金（セント）';
COMMENT ON COLUMN studios.pack_10_price IS '10回券料金（セント）';
COMMENT ON COLUMN studios.monthly_price IS '月額会員料金（セント）';

-- 会員の月額サブスクリプションID（customer.subscription.deleted で特定用）
ALTER TABLE members
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

COMMENT ON COLUMN members.stripe_subscription_id IS '会員の月額StripeサブスクリプションID';
