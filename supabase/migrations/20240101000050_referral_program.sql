-- ==============================================
-- Referral Program
-- オーナー紹介プログラム：双方に1ヶ月無料特典
-- ==============================================

-- ============================================
-- referral_codes テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL UNIQUE REFERENCES studios(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- コード検索用インデックス
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

-- ============================================
-- referral_rewards テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_studio_id uuid NOT NULL REFERENCES studios(id),
  referred_studio_id uuid NOT NULL REFERENCES studios(id),
  status text DEFAULT 'pending',
  referrer_reward_applied boolean DEFAULT false,
  referred_reward_applied boolean DEFAULT false,
  stripe_coupon_id_referrer text,
  stripe_coupon_id_referred text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (referrer_studio_id, referred_studio_id)
);

-- 紹介者のステータス検索用
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_studio_id, status);
-- 被紹介者のステータス検索用
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON referral_rewards(referred_studio_id, status);

-- ============================================
-- studios テーブルに referred_by_code カラム追加
-- ============================================
ALTER TABLE studios ADD COLUMN IF NOT EXISTS referred_by_code text;

-- ============================================
-- RLS ポリシー
-- ============================================

-- referral_codes の RLS を有効化
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

-- Ownerは自分のスタジオのコードのみ閲覧可能
CREATE POLICY "owners_view_own_referral_code"
  ON referral_codes
  FOR SELECT
  USING (
    studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- referral_rewards の RLS を有効化
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Ownerは自分が紹介者 or 被紹介者のレコードのみ閲覧可能
CREATE POLICY "owners_view_own_referral_rewards"
  ON referral_rewards
  FOR SELECT
  USING (
    referrer_studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'owner'
    )
    OR
    referred_studio_id IN (
      SELECT studio_id FROM profiles WHERE id = auth.uid() AND role = 'owner'
    )
  );
