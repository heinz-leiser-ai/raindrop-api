-- RDBE-10: Collection sharing and collaboration

CREATE TABLE collection_sharing (
  id SERIAL PRIMARY KEY,
  collection_id INTEGER NOT NULL REFERENCES collections(_id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES profiles(integer_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'owner')),
  token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE collection_sharing ENABLE ROW LEVEL SECURITY;

-- Owner of collection can manage sharing
CREATE POLICY "Collection owners can manage sharing"
  ON collection_sharing FOR ALL
  USING (
    collection_id IN (
      SELECT _id FROM collections
      WHERE user_id IN (SELECT integer_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Shared users can read their own sharing entry
CREATE POLICY "Shared users can read own entry"
  ON collection_sharing FOR SELECT
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_sharing_collection ON collection_sharing(collection_id);
CREATE INDEX idx_sharing_user ON collection_sharing(user_id);
CREATE INDEX idx_sharing_token ON collection_sharing(token) WHERE token IS NOT NULL;
