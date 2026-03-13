-- RDBE-4: Raindrops (Bookmarks) table with full-text search and collection count triggers

CREATE TABLE raindrops (
  _id SERIAL PRIMARY KEY,
  collection_id INTEGER NOT NULL DEFAULT -1,
  user_id INTEGER NOT NULL REFERENCES profiles(integer_id) ON DELETE CASCADE,
  link TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'link'
    CHECK (type IN ('link', 'article', 'image', 'video', 'document', 'audio')),
  cover TEXT NOT NULL DEFAULT '',
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  domain TEXT NOT NULL DEFAULT '',
  important BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  removed BOOLEAN NOT NULL DEFAULT false,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  reminder JSONB,
  file JSONB,
  pleaseParse JSONB,
  created TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_update TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE raindrops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own raindrops"
  ON raindrops FOR SELECT
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own raindrops"
  ON raindrops FOR INSERT
  WITH CHECK (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update own raindrops"
  ON raindrops FOR UPDATE
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ))
  WITH CHECK (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete own raindrops"
  ON raindrops FOR DELETE
  USING (user_id IN (
    SELECT integer_id FROM profiles WHERE id = auth.uid()
  ));

-- Performance indices
CREATE INDEX idx_raindrops_collection ON raindrops(collection_id, user_id);
CREATE INDEX idx_raindrops_user ON raindrops(user_id);
CREATE INDEX idx_raindrops_created ON raindrops(created DESC);
CREATE INDEX idx_raindrops_order ON raindrops(collection_id, "order");
CREATE INDEX idx_raindrops_domain ON raindrops(domain);
CREATE INDEX idx_raindrops_tags ON raindrops USING GIN(tags);
CREATE INDEX idx_raindrops_important ON raindrops(user_id) WHERE important = true;

-- Full-text search index
ALTER TABLE raindrops ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(note, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(domain, '')), 'D')
  ) STORED;

CREATE INDEX idx_raindrops_search ON raindrops USING GIN(search_vector);

-- Auto-update last_update timestamp (reuses function from auth migration)
CREATE TRIGGER raindrops_updated_at
  BEFORE UPDATE ON raindrops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-extract domain from link on insert/update
CREATE OR REPLACE FUNCTION extract_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.link IS NOT NULL AND NEW.link != '' THEN
    NEW.domain = regexp_replace(
      regexp_replace(NEW.link, '^https?://(www\.)?', ''),
      '/.*$', ''
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER raindrops_extract_domain
  BEFORE INSERT OR UPDATE OF link ON raindrops
  FOR EACH ROW
  EXECUTE FUNCTION extract_domain();

-- Update collection.count when raindrops change
CREATE OR REPLACE FUNCTION update_collection_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrement old collection count
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.collection_id > 0 THEN
      UPDATE collections SET count = GREATEST(count - 1, 0)
        WHERE _id = OLD.collection_id;
    END IF;
  END IF;

  -- Increment new collection count
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.collection_id > 0 THEN
      UPDATE collections SET count = count + 1
        WHERE _id = NEW.collection_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER raindrops_collection_count
  AFTER INSERT OR UPDATE OF collection_id OR DELETE ON raindrops
  FOR EACH ROW
  EXECUTE FUNCTION update_collection_count();
