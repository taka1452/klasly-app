-- ============================================
-- studios テーブルに予約クレジット設定を追加
--
-- booking_requires_credits:
--   null  = 自動判定（stripe_connect_onboarding_complete に基づく）
--   true  = 常にクレジット必須（手動 ON）
--   false = 常にクレジット不要（手動 OFF / 現金スタジオ向け）
-- ============================================

alter table studios
  add column if not exists booking_requires_credits boolean default null;
