ALTER TABLE news.cig_watch_entries
    ADD COLUMN IF NOT EXISTS title_fr VARCHAR(300),
    ADD COLUMN IF NOT EXISTS raw_excerpt_fr TEXT,
    ADD COLUMN IF NOT EXISTS raw_payload_fr TEXT;

