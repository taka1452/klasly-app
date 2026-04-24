-- ============================================================
-- Online library — paid membership tiers + integrations
-- ============================================================
-- Requested by Sunrise Yoga Studio (Jamie feedback 2026-04):
--   "We are setting up an online library of classes accessible via a paid
--    membership. Is there a way to connect Klasly with Google to track
--    these payments and memberships?"
--
-- Reuses the existing video_content table as the library content store. Adds:
--   * library_access_tier on each video (free | members | premium)
--   * library_memberships: a member's paid subscription to the library
--   * integration_connections: generic table for OAuth-style integrations
--     (Google Workspace, Google Pay tracking, Mailchimp, Zoom etc.)

-- 1. Access tier on library content.
ALTER TABLE public.video_content
  ADD COLUMN IF NOT EXISTS library_access_tier text NOT NULL DEFAULT 'members'
    CHECK (library_access_tier IN ('free', 'members', 'premium'));

-- 2. Member library subscriptions.
CREATE TABLE IF NOT EXISTS public.library_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  tier text NOT NULL,
    -- 'basic' | 'premium' (studio-defined for now; easy to extend to a
    --  library_membership_tiers table if needed)
  status text NOT NULL DEFAULT 'active',
    -- 'active' | 'paused' | 'cancelled' | 'past_due'
  stripe_subscription_id text,
  stripe_customer_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  cancel_at timestamptz,
  cancelled_at timestamptz,
  price_cents integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_library_memberships_status
  ON public.library_memberships(studio_id, status);

ALTER TABLE public.library_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studio_admins_manage_library_memberships"
  ON public.library_memberships FOR ALL
  USING (
    studio_id IN (
      SELECT studio_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

CREATE POLICY "member_view_own_library_membership"
  ON public.library_memberships FOR SELECT
  USING (
    member_id IN (
      SELECT id FROM public.members WHERE profile_id = auth.uid()
    )
  );

-- 3. Generic integration connection store (Google, Mailchimp, Zoom…).
CREATE TABLE IF NOT EXISTS public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  provider text NOT NULL,
    -- 'google' | 'mailchimp' | 'zoom' | ...
  status text NOT NULL DEFAULT 'pending',
    -- 'pending' | 'connected' | 'disconnected' | 'error'
  connected_email text,
  scopes text[] NOT NULL DEFAULT '{}',
  access_token_cipher text,       -- encrypted server-side before write
  refresh_token_cipher text,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, provider)
);

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studio_admins_manage_integrations"
  ON public.integration_connections FOR ALL
  USING (
    studio_id IN (
      SELECT studio_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    studio_id IN (
      SELECT studio_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- updated_at triggers.
CREATE OR REPLACE FUNCTION public.tg_library_memberships_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_memberships_updated_at ON public.library_memberships;
CREATE TRIGGER trg_library_memberships_updated_at
  BEFORE UPDATE ON public.library_memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_library_memberships_updated_at();

CREATE OR REPLACE FUNCTION public.tg_integration_connections_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_integration_connections_updated_at ON public.integration_connections;
CREATE TRIGGER trg_integration_connections_updated_at
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_integration_connections_updated_at();
