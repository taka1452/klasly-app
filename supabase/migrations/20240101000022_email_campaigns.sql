-- ============================================
-- Email Campaigns
-- Owners can send bulk emails to members
-- ============================================

CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_filter JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent')),
  sent_at TIMESTAMPTZ,
  sent_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_campaigns_studio_id ON email_campaigns(studio_id);

-- RLS
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON email_campaigns FOR ALL TO service_role USING (true);

-- Owners full access to their studio campaigns
CREATE POLICY "owners_all" ON email_campaigns FOR ALL USING (
  studio_id IN (
    SELECT p.studio_id FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager')
  )
);
