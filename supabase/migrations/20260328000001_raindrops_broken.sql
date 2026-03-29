-- RAIN-5: Add broken column to raindrops for link health check

ALTER TABLE raindrops ADD COLUMN broken BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_raindrops_broken ON raindrops(user_id) WHERE broken = true;
