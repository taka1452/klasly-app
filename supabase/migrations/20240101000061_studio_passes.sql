-- Studio Passes: pass definitions, subscriptions, usage tracking, and payout distributions

-- 1. studio_passes — pass templates created by studio owner
CREATE TABLE studio_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL,
  billing_interval text NOT NULL DEFAULT 'month',
  max_classes_per_month integer, -- NULL = unlimited
  auto_distribute boolean NOT NULL DEFAULT false,
  stripe_price_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE studio_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manage studio_passes" ON studio_passes
  FOR ALL USING (
    studio_id IN (
      SELECT p.studio_id FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager')
    )
  );

CREATE POLICY "member view active studio_passes" ON studio_passes
  FOR SELECT USING (
    is_active = true
    AND studio_id IN (
      SELECT m.studio_id FROM members m
      JOIN profiles p ON p.id = auth.uid()
      WHERE m.profile_id = p.id
    )
  );

-- 2. pass_subscriptions — member subscriptions to a pass
CREATE TABLE pass_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_pass_id uuid NOT NULL REFERENCES studio_passes(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'active', -- active / cancelled / past_due
  current_period_start date,
  current_period_end date,
  classes_used_this_period integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pass_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manage pass_subscriptions" ON pass_subscriptions
  FOR ALL USING (
    studio_pass_id IN (
      SELECT sp.id FROM studio_passes sp
      JOIN profiles p ON p.id = auth.uid()
      WHERE sp.studio_id = p.studio_id AND p.role IN ('owner', 'manager')
    )
  );

CREATE POLICY "member view own pass_subscriptions" ON pass_subscriptions
  FOR SELECT USING (
    member_id IN (
      SELECT m.id FROM members m WHERE m.profile_id = auth.uid()
    )
  );

-- 3. pass_class_usage — tracks individual class session usage against a pass
CREATE TABLE pass_class_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_subscription_id uuid NOT NULL REFERENCES pass_subscriptions(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pass_subscription_id, session_id)
);

ALTER TABLE pass_class_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manage pass_class_usage" ON pass_class_usage
  FOR ALL USING (
    pass_subscription_id IN (
      SELECT ps.id FROM pass_subscriptions ps
      JOIN studio_passes sp ON sp.id = ps.studio_pass_id
      JOIN profiles p ON p.id = auth.uid()
      WHERE sp.studio_id = p.studio_id AND p.role IN ('owner', 'manager')
    )
  );

CREATE POLICY "member view own pass_class_usage" ON pass_class_usage
  FOR SELECT USING (
    pass_subscription_id IN (
      SELECT ps.id FROM pass_subscriptions ps
      JOIN members m ON m.id = ps.member_id
      WHERE m.profile_id = auth.uid()
    )
  );

-- 4. pass_distributions — instructor payout distribution records
CREATE TABLE pass_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  studio_pass_id uuid NOT NULL REFERENCES studio_passes(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_classes integer NOT NULL DEFAULT 0,
  total_pool_classes integer NOT NULL DEFAULT 0,
  gross_pool_amount integer NOT NULL DEFAULT 0, -- cents
  payout_amount integer NOT NULL DEFAULT 0, -- cents
  stripe_transfer_id text,
  status text NOT NULL DEFAULT 'pending', -- pending / approved / completed / failed
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pass_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manage pass_distributions" ON pass_distributions
  FOR ALL USING (
    studio_id IN (
      SELECT p.studio_id FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'manager')
    )
  );

CREATE POLICY "instructor view own pass_distributions" ON pass_distributions
  FOR SELECT USING (
    instructor_id IN (
      SELECT i.id FROM instructors i WHERE i.profile_id = auth.uid()
    )
  );

-- Service role bypass for all tables (webhook / cron usage)
CREATE POLICY "service role bypass studio_passes" ON studio_passes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service role bypass pass_subscriptions" ON pass_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service role bypass pass_class_usage" ON pass_class_usage
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service role bypass pass_distributions" ON pass_distributions
  FOR ALL USING (auth.role() = 'service_role');
