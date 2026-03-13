-- RDBE-3: Collections table with nested structure support

CREATE TABLE collections (
  _id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  parent_id INTEGER REFERENCES collections(_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES profiles(integer_id) ON DELETE CASCADE,
  color TEXT,
  cover TEXT[] NOT NULL DEFAULT '{}',
  view TEXT NOT NULL DEFAULT 'list'
    CHECK (view IN ('list', 'simple', 'grid', 'masonry')),
  public BOOLEAN NOT NULL DEFAULT false,
  expanded BOOLEAN NOT NULL DEFAULT false,
  sort INTEGER NOT NULL DEFAULT 0,
  count INTEGER NOT NULL DEFAULT 0,
  created TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_update TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT no_self_parent CHECK (_id != parent_id)
);

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own collections"
  ON collections FOR SELECT
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own collections"
  ON collections FOR INSERT
  WITH CHECK (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update own collections"
  ON collections FOR UPDATE
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ))
  WITH CHECK (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete own collections"
  ON collections FOR DELETE
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_collections_user_id ON collections(user_id);
CREATE INDEX idx_collections_parent_id ON collections(parent_id);
CREATE INDEX idx_collections_sort ON collections(user_id, sort);

-- Auto-update last_update timestamp
CREATE TRIGGER collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
