-- =============================================
-- SOAP Notes (Body Therapist Records)
-- Sprint 2 - Task C
-- =============================================

CREATE TABLE IF NOT EXISTS soap_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  session_id uuid REFERENCES class_sessions(id),
  -- SOAP fields
  subjective text,
  objective text,
  assessment text,
  plan text,
  -- メタデータ
  session_date date NOT NULL,
  is_confidential boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE soap_notes ENABLE ROW LEVEL SECURITY;

-- インストラクターは自分のノートのみ管理可能
CREATE POLICY "Instructor can manage own SOAP notes"
  ON soap_notes FOR ALL
  USING (instructor_id IN (
    SELECT id FROM instructors WHERE profile_id = auth.uid()
  ));

-- is_confidential = false の場合のみオーナーが閲覧可能
CREATE POLICY "Owner can view non-confidential SOAP notes"
  ON soap_notes FOR SELECT
  USING (
    is_confidential = false
    AND studio_id IN (
      SELECT studio_id FROM profiles
      WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- インデックス
CREATE INDEX IF NOT EXISTS idx_soap_notes_instructor_member
  ON soap_notes(instructor_id, member_id, session_date DESC);
