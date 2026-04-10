-- ============================================
-- Push Notification Subscriptions
-- ============================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 誰のサブスクリプションか
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  studio_id uuid REFERENCES studios(id) ON DELETE CASCADE,

  -- ブラウザの Push Subscription オブジェクト
  endpoint text NOT NULL,
  p256dh text NOT NULL,        -- 暗号化用の公開鍵
  auth text NOT NULL,          -- 認証シークレット

  -- デバイス識別（同一ユーザーの複数デバイス対応）
  user_agent text,
  device_name text,            -- "iPhone Safari" / "Chrome Desktop" 等（自動検出）

  -- 状態管理
  is_active boolean DEFAULT true,
  last_used_at timestamptz DEFAULT now(),
  failed_count integer DEFAULT 0,  -- 送信失敗回数。3回超えたら is_active = false

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- 同一デバイスの重複防止
  UNIQUE(profile_id, endpoint)
);

-- ============================================
-- 通知設定（ユーザーごと）
-- ============================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  studio_id uuid REFERENCES studios(id) ON DELETE CASCADE,

  -- 通知タイプごとのON/OFF
  booking_confirmation boolean DEFAULT true,
  booking_cancellation boolean DEFAULT true,
  class_reminder boolean DEFAULT true,       -- クラス1時間前
  waitlist_promotion boolean DEFAULT true,
  new_message boolean DEFAULT true,
  studio_announcement boolean DEFAULT true,

  -- 配信チャネル
  push_enabled boolean DEFAULT true,         -- Push通知全体のON/OFF
  email_enabled boolean DEFAULT true,        -- メール通知全体のON/OFF

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(profile_id, studio_id)
);

-- ============================================
-- Push 送信ログ（デバッグ & 統計用）
-- ============================================

CREATE TABLE IF NOT EXISTS push_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid REFERENCES studios(id),
  profile_id uuid REFERENCES profiles(id),
  notification_type text NOT NULL,  -- booking_confirmation / class_reminder / etc.
  title text NOT NULL,
  body text,
  status text DEFAULT 'sent',       -- sent / failed / skipped
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_logs ENABLE ROW LEVEL SECURITY;

-- push_subscriptions: 本人のみ閲覧・操作
CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (profile_id = auth.uid());

-- notification_preferences: 本人のみ
CREATE POLICY "Users can manage own notification preferences"
  ON notification_preferences FOR ALL
  USING (profile_id = auth.uid());

-- push_logs: Ownerは自分のスタジオのログを閲覧可能
CREATE POLICY "Owner can view push logs"
  ON push_logs FOR SELECT
  USING (
    studio_id IN (
      SELECT studio_id FROM profiles
      WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- インデックス
CREATE INDEX IF NOT EXISTS idx_push_subs_profile ON push_subscriptions(profile_id, is_active);
CREATE INDEX IF NOT EXISTS idx_push_subs_studio ON push_subscriptions(studio_id, is_active);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_profile ON notification_preferences(profile_id, studio_id);
CREATE INDEX IF NOT EXISTS idx_push_logs_studio ON push_logs(studio_id, created_at DESC);
