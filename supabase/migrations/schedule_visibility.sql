-- class_sessions に is_public カラムを追加
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;

-- 既存のセッションは全てpublic
UPDATE class_sessions SET is_public = true WHERE is_public IS NULL;
