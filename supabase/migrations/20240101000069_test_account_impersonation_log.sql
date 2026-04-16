-- ============================================================
-- Audit log for Test Account Switcher impersonation sessions.
-- Captures who switched into which test account, and when they
-- switched back.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.test_account_impersonation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  actor_profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('switch_in', 'switch_back')),
  actor_role text,
  target_role text,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_studio_created
  ON public.test_account_impersonation_logs (studio_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_actor
  ON public.test_account_impersonation_logs (actor_profile_id, created_at DESC);

ALTER TABLE public.test_account_impersonation_logs ENABLE ROW LEVEL SECURITY;

-- Owners and managers with can_manage_settings can view logs for their own studio.
CREATE POLICY impersonation_logs_read ON public.test_account_impersonation_logs
  FOR SELECT USING (
    studio_id IN (
      SELECT studio_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
    OR studio_id IN (
      SELECT m.studio_id FROM public.managers m
      WHERE m.profile_id = auth.uid() AND m.can_manage_settings = true
    )
  );

-- Only the service role writes (from the API route).
CREATE POLICY impersonation_logs_service ON public.test_account_impersonation_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
