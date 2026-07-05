-- Fix: raindrops + collections tables use 'last_update' not 'updated_at'
-- The shared update_updated_at() trigger only works for tables with 'updated_at' column

-- Raindrops
DROP TRIGGER IF EXISTS raindrops_updated_at ON raindrops;

CREATE OR REPLACE FUNCTION update_raindrops_last_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_update = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER raindrops_last_update
  BEFORE UPDATE ON raindrops
  FOR EACH ROW
  EXECUTE FUNCTION update_raindrops_last_update();

-- Collections
DROP TRIGGER IF EXISTS collections_updated_at ON collections;

CREATE OR REPLACE FUNCTION update_collections_last_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_update = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collections_last_update
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_collections_last_update();
