CREATE TABLE IF NOT EXISTS news.cig_watch_entries (
    id BIGSERIAL PRIMARY KEY,
    source_id BIGINT NOT NULL,
    source_label VARCHAR(150) NOT NULL,
    source_url TEXT NOT NULL,
    external_id VARCHAR(255),
    title VARCHAR(300) NOT NULL,
    link TEXT NOT NULL,
    entry_type VARCHAR(120) NOT NULL,
    published_at TIMESTAMPTZ,
    rank_hint BIGINT,
    raw_excerpt TEXT,
    raw_payload TEXT,
    fetched_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cig_watch_entries_source_link UNIQUE (source_id, link)
);

CREATE INDEX IF NOT EXISTS idx_cig_watch_entries_fetched_at ON news.cig_watch_entries (fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_cig_watch_entries_published_at ON news.cig_watch_entries (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_cig_watch_entries_source_id ON news.cig_watch_entries (source_id);

CREATE TABLE IF NOT EXISTS news.cig_watch_fetch_errors (
    id BIGSERIAL PRIMARY KEY,
    source_id BIGINT NOT NULL,
    source_label VARCHAR(150) NOT NULL,
    source_url TEXT NOT NULL,
    message VARCHAR(220) NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cig_watch_fetch_errors_fetched_at ON news.cig_watch_fetch_errors (fetched_at DESC);
