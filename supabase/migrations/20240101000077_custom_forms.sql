-- ============================================================
-- Custom forms & documents builder
-- ============================================================
-- Requested by Sunrise Yoga Studio (Jamie feedback 2026-04):
--   "Can you give us an option to create other forms or documents that we
--    need and can link to from our website? We need applications for new
--    instructors, contracts, medical intake forms, multiple waiver options."
--
-- A generic, studio-scoped form definition that produces a public submission
-- URL (/forms/<id>). Types cover the four use cases Jamie asked for plus
-- "custom" as an escape hatch. Each form stores an ordered array of fields
-- as JSONB; submissions store the keyed responses plus optional signature.
CREATE TABLE IF NOT EXISTS public.custom_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  form_type text NOT NULL DEFAULT 'custom',
    -- 'waiver' | 'application' | 'contract' | 'medical_intake' | 'custom'
  name text NOT NULL,
  description text,
  intro_text text,                  -- shown above the form
  success_message text,             -- shown after submission
  fields jsonb NOT NULL DEFAULT '[]',
    -- Each field: { id: uuid, label, type, required, placeholder?, options?,
    --               help_text?, sensitive? }
    -- types: text | textarea | email | tel | date | select | radio | checkbox
    --      | signature | acknowledgement
  requires_signature boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
    -- public = reachable at /forms/<id> without login; private = members only
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_forms_studio_type
  ON public.custom_forms(studio_id, form_type);

CREATE INDEX IF NOT EXISTS idx_custom_forms_studio_active
  ON public.custom_forms(studio_id, is_active);

CREATE TABLE IF NOT EXISTS public.custom_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.custom_forms(id) ON DELETE CASCADE,
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  submitter_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitter_name text,
  submitter_email text,
  submitter_phone text,
  responses jsonb NOT NULL DEFAULT '{}',
  signature_data text,      -- data-URL base64 of the signature PNG, or typed name
  signed_at timestamptz,
  ip_address text,
  user_agent text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form
  ON public.custom_form_submissions(form_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_form_submissions_studio
  ON public.custom_form_submissions(studio_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_form_submissions_email
  ON public.custom_form_submissions(studio_id, submitter_email);

ALTER TABLE public.custom_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_form_submissions ENABLE ROW LEVEL SECURITY;

-- Owners / managers manage forms for their studio.
CREATE POLICY "studio_admins_manage_forms"
  ON public.custom_forms FOR ALL
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

-- Anyone can read an active public form to submit it (matches the
-- existing waiver-signing pattern).
CREATE POLICY "anyone_read_active_public_forms"
  ON public.custom_forms FOR SELECT
  USING (is_active = true AND is_public = true);

-- Owners / managers manage submissions for their studio.
CREATE POLICY "studio_admins_manage_form_submissions"
  ON public.custom_form_submissions FOR ALL
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

-- Submitters can read their own submissions.
CREATE POLICY "submitter_read_own_submissions"
  ON public.custom_form_submissions FOR SELECT
  USING (submitter_profile_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_custom_forms_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_custom_forms_updated_at ON public.custom_forms;
CREATE TRIGGER trg_custom_forms_updated_at
  BEFORE UPDATE ON public.custom_forms
  FOR EACH ROW EXECUTE FUNCTION public.tg_custom_forms_updated_at();
