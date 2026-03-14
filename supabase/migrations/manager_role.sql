-- ============================================
-- Manager Role
-- オーナーのアシスタントとしてダッシュボードにアクセスできる
-- 危険な操作（スタジオ削除・Stripe設定変更等）は不可
-- ============================================

-- managers テーブル: マネージャー固有情報
CREATE TABLE IF NOT EXISTS public.managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 権限フラグ
  can_manage_members boolean DEFAULT true,     -- メンバー管理
  can_manage_classes boolean DEFAULT true,     -- クラス管理
  can_manage_instructors boolean DEFAULT false, -- インストラクター管理
  can_manage_bookings boolean DEFAULT true,    -- 予約管理
  can_manage_rooms boolean DEFAULT true,       -- ルーム管理
  can_view_payments boolean DEFAULT true,      -- 支払い閲覧（編集不可）
  can_send_messages boolean DEFAULT true,      -- メッセージ送信
  created_at timestamptz DEFAULT now(),
  UNIQUE(studio_id, profile_id)
);

-- RLS
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;

-- オーナーは自スタジオのマネージャーを完全管理
CREATE POLICY "owner_manage_managers" ON public.managers
  FOR ALL USING (
    studio_id IN (
      SELECT studio_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- マネージャーは自身のレコードを閲覧
CREATE POLICY "manager_view_own" ON public.managers
  FOR SELECT USING (profile_id = auth.uid());
