-- スタジオごとの通貨設定を追加（デフォルト: USD）
ALTER TABLE studios ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'usd';
