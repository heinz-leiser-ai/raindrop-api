-- RAIN-5: Add last_checked timestamp to raindrops for incremental link checking

ALTER TABLE raindrops ADD COLUMN last_checked TIMESTAMPTZ DEFAULT NULL;
