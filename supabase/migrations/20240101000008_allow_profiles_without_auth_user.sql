-- CSV インポート（メンバー・インストラクター）でログインなしのプロファイルを
-- 作成できるよう、profiles.id → auth.users.id の FK 制約を削除する。
-- 通常のサインアップフロー（trigger による profiles 自動作成）は引き続き動作する。
-- auth.users 削除時の profiles 自動削除（ON DELETE CASCADE）は無効になるが許容範囲。

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
