-- Stripe Connect 経由の決済用に、Connected Account 側の顧客 ID を保存するカラム。
-- プラットフォーム時代の stripe_customer_id と分離し、Connect 決済時のエラーを防ぐ。
ALTER TABLE members
ADD COLUMN IF NOT EXISTS stripe_connect_customer_id TEXT;
