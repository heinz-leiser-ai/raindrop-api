-- RAIN-5: Journal for deleted broken bookmarks

CREATE TABLE link_check_journal (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES profiles(integer_id) ON DELETE CASCADE,
  bookmark_title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  collection_name TEXT NOT NULL DEFAULT '',
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE link_check_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own journal"
  ON link_check_journal FOR SELECT
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own journal"
  ON link_check_journal FOR INSERT
  WITH CHECK (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete own journal"
  ON link_check_journal FOR DELETE
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_link_check_journal_user ON link_check_journal(user_id, deleted_at DESC);
