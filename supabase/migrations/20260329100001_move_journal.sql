-- RAIN-7: Activity journal for bookmark/collection moves, trash, restore, create

CREATE TABLE move_journal (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES profiles(integer_id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('move', 'trash', 'restore', 'create')),
  object_type TEXT NOT NULL CHECK (object_type IN ('bookmark', 'collection')),
  object_id INTEGER NOT NULL,
  object_title TEXT NOT NULL DEFAULT '',
  from_collection_id INTEGER,
  from_collection_name TEXT NOT NULL DEFAULT '',
  to_collection_id INTEGER,
  to_collection_name TEXT NOT NULL DEFAULT '',
  undone BOOLEAN NOT NULL DEFAULT false,
  batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE move_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own move journal"
  ON move_journal FOR SELECT
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own move journal"
  ON move_journal FOR INSERT
  WITH CHECK (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update own move journal"
  ON move_journal FOR UPDATE
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete own move journal"
  ON move_journal FOR DELETE
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_move_journal_user ON move_journal(user_id, created_at DESC);
CREATE INDEX idx_move_journal_batch ON move_journal(batch_id) WHERE batch_id IS NOT NULL;

-- Auto-cleanup: delete entries older than 90 days
-- Run via pg_cron or Supabase scheduled function:
-- SELECT cron.schedule('move-journal-cleanup', '0 3 * * *', $$DELETE FROM move_journal WHERE created_at < now() - interval '90 days'$$);
