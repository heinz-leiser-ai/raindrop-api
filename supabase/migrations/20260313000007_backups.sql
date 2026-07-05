-- RDBE-11: Backups metadata table

CREATE TABLE backups (
  _id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id INTEGER NOT NULL REFERENCES profiles(integer_id) ON DELETE CASCADE,
  format TEXT NOT NULL DEFAULT 'html' CHECK (format IN ('html', 'csv')),
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  created TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own backups"
  ON backups FOR SELECT
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own backups"
  ON backups FOR INSERT
  WITH CHECK (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete own backups"
  ON backups FOR DELETE
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_backups_user ON backups(user_id, created DESC);
