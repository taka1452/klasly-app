-- ==============================================
-- Session Generation Weeks Setting
-- スタジオごとにセッション自動生成の週数を設定可能にする
-- ==============================================

-- studios テーブルに session_generation_weeks カラムを追加
ALTER TABLE studios ADD COLUMN IF NOT EXISTS session_generation_weeks integer DEFAULT 8;

-- 既存スタジオのデータを更新
UPDATE studios SET session_generation_weeks = 8 WHERE session_generation_weeks IS NULL;
