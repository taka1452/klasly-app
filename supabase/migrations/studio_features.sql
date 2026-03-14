-- ============================================
-- Studio Feature Flags
-- スタジオ単位で機能のON/OFFを制御する
-- ============================================

CREATE TABLE IF NOT EXISTS public.studio_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(studio_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_studio_features_studio_id ON public.studio_features(studio_id);
CREATE INDEX IF NOT EXISTS idx_studio_features_feature_key ON public.studio_features(feature_key);

ALTER TABLE public.studio_features ENABLE ROW LEVEL SECURITY;

-- Owner/Manager/Instructor/Member: 自スタジオのフラグを閲覧可能
CREATE POLICY "Studio members can view own studio features"
  ON public.studio_features FOR SELECT
  USING (
    studio_id IN (
      SELECT p.studio_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- 更新はservice_role経由のみ（Admin API）
-- フロントエンドからの直接更新は不可
