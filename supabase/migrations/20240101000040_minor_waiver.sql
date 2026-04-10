-- waiver_templates に waiver_type カラムを追加
ALTER TABLE waiver_templates ADD COLUMN IF NOT EXISTS waiver_type text DEFAULT 'standard';
-- 値: 'standard'（既存の通常Waiver）, 'minor'（未成年用、将来用）

-- waiver_signatures に保護者情報カラムを追加
ALTER TABLE waiver_signatures ADD COLUMN IF NOT EXISTS guardian_name text;
ALTER TABLE waiver_signatures ADD COLUMN IF NOT EXISTS guardian_email text;
ALTER TABLE waiver_signatures ADD COLUMN IF NOT EXISTS guardian_relationship text;
-- 値: 'parent' / 'legal_guardian'
ALTER TABLE waiver_signatures ADD COLUMN IF NOT EXISTS is_minor boolean DEFAULT false;

-- members に未成年フラグを追加
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_minor boolean DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE members ADD COLUMN IF NOT EXISTS guardian_email text;
