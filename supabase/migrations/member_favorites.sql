-- Member Favorites: allows members to favorite classes and instructors
CREATE TABLE IF NOT EXISTS member_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  favorite_type text NOT NULL CHECK (favorite_type IN ('class', 'instructor')),
  target_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(member_id, favorite_type, target_id)
);

-- RLS
ALTER TABLE member_favorites ENABLE ROW LEVEL SECURITY;

-- Member can read/insert/delete own favorites
CREATE POLICY "member_manage_own_favorites"
  ON member_favorites FOR ALL
  USING (
    member_id IN (
      SELECT id FROM members WHERE profile_id = auth.uid()
    )
  );

-- Owner can view all favorites in their studio
CREATE POLICY "owner_view_studio_favorites"
  ON member_favorites FOR SELECT
  USING (
    studio_id IN (
      SELECT studio_id FROM profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Index for fast lookups
CREATE INDEX idx_member_favorites_member ON member_favorites(member_id);
CREATE INDEX idx_member_favorites_target ON member_favorites(favorite_type, target_id);
