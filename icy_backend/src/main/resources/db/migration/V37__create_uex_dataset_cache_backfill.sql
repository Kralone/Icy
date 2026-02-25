CREATE SCHEMA IF NOT EXISTS utils;

CREATE TABLE IF NOT EXISTS utils.uex_dataset_cache (
    dataset_key VARCHAR(80) PRIMARY KEY,
    source_url TEXT NOT NULL,
    payload JSONB NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 0,
    fetched_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uex_dataset_cache_fetched_at
    ON utils.uex_dataset_cache (fetched_at DESC);
