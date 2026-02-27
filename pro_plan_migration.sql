-- ============================================
-- Klasly - Pro Plan  Migration
-- Free/Studio/Grow を廃止し、Pro プラン 1 本に統一
-- Supabase SQL Editor で実行してください
-- ============================================

-- studios テーブルの変更
ALTER TABLE studios ALTER COLUMN plan SET DEFAULT 'pro';
ALTER TABLE studios ALTER COLUMN plan_status SET DEFAULT 'trialing';

ALTER TABLE studios
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_period TEXT,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_reminder_sent BOOLEAN DEFAULT false;

COMMENT ON COLUMN studios.trial_ends_at IS 'トライアル終了日時';
COMMENT ON COLUMN studios.subscription_period IS 'monthly or yearly';
COMMENT ON COLUMN studios.current_period_end IS '現在の課金期間終了日';
COMMENT ON COLUMN studios.cancel_at_period_end IS '期間終了時にキャンセル予定';
COMMENT ON COLUMN studios.grace_period_ends_at IS '猶予期間終了日';
COMMENT ON COLUMN studios.trial_reminder_sent IS 'トライアル終了3日前リマインド送信済み';

-- 既存データ: plan_status が null または 'active' で stripe_subscription_id がない場合は 'trialing' のまま
-- （新規オンボーディングは plan 選択 → checkout で trialing になる）
-- 既存の free/studio/grow ユーザーは plan を 'pro' に移行、plan_status は適宜

UPDATE studios
SET plan = 'pro'
WHERE plan IN ('free', 'studio', 'grow');
