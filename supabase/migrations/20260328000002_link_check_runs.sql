-- RAIN-5: Link check runs tracking table

CREATE TABLE link_check_runs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES profiles(integer_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  total INTEGER NOT NULL DEFAULT 0,
  checked INTEGER NOT NULL DEFAULT 0,
  broken_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

ALTER TABLE link_check_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own runs"
  ON link_check_runs FOR SELECT
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own runs"
  ON link_check_runs FOR INSERT
  WITH CHECK (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update own runs"
  ON link_check_runs FOR UPDATE
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE INDEX idx_link_check_runs_user ON link_check_runs(user_id);
CREATE INDEX idx_link_check_runs_status ON link_check_runs(user_id, status);
