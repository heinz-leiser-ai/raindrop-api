-- Heartbeat table for Supabase free-tier keep-alive (GitHub Actions daily ping)
CREATE TABLE keep_alive (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO keep_alive (id) VALUES (1);

ALTER TABLE keep_alive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read keep_alive"
  ON keep_alive FOR SELECT
  TO anon
  USING (true);
