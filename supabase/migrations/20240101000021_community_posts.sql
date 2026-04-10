-- ============================================
-- Community Bulletin Board
-- Studio-level posts and comments
-- ============================================

CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL CHECK (author_role IN ('owner', 'instructor', 'member', 'manager')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX community_posts_studio_id ON community_posts(studio_id);
CREATE INDEX community_posts_created_at ON community_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL CHECK (author_role IN ('owner', 'instructor', 'member', 'manager')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX community_comments_post_id ON community_comments(post_id);

-- RLS
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_role_all" ON community_posts FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON community_comments FOR ALL TO service_role USING (true);

-- Anyone in the studio can read posts
CREATE POLICY "studio_members_select_posts" ON community_posts FOR SELECT USING (
  studio_id IN (
    SELECT p.studio_id FROM profiles p WHERE p.id = auth.uid()
  )
);

-- Owner/Instructor/Manager can create posts
CREATE POLICY "staff_insert_posts" ON community_posts FOR INSERT WITH CHECK (
  author_id = auth.uid()
  AND author_role IN ('owner', 'instructor', 'manager')
);

-- Authors can delete their own posts
CREATE POLICY "authors_delete_posts" ON community_posts FOR DELETE USING (
  author_id = auth.uid()
);

-- Anyone in the studio can read comments
CREATE POLICY "studio_members_select_comments" ON community_comments FOR SELECT USING (
  post_id IN (
    SELECT cp.id FROM community_posts cp
    JOIN profiles p ON p.studio_id = cp.studio_id
    WHERE p.id = auth.uid()
  )
);

-- Anyone in the studio can add comments
CREATE POLICY "studio_members_insert_comments" ON community_comments FOR INSERT WITH CHECK (
  author_id = auth.uid()
);

-- Authors can delete their own comments
CREATE POLICY "authors_delete_comments" ON community_comments FOR DELETE USING (
  author_id = auth.uid()
);
