ALTER TABLE catalog.sync_runs
    DROP CONSTRAINT chk_catalog_sync_status;

ALTER TABLE catalog.sync_runs
    ADD CONSTRAINT chk_catalog_sync_status
        CHECK (status IN ('QUEUED', 'RUNNING', 'WAITING_FOR_REVIEW', 'SUCCEEDED', 'FAILED'));

DROP INDEX catalog.uk_catalog_sync_one_active_run;

CREATE UNIQUE INDEX uk_catalog_sync_one_active_run
    ON catalog.sync_runs ((1))
    WHERE status IN ('QUEUED', 'RUNNING', 'WAITING_FOR_REVIEW');

CREATE TABLE catalog.canonical_selections (
    source VARCHAR(40) NOT NULL,
    dataset_key VARCHAR(80) NOT NULL,
    canonical_key VARCHAR(700) NOT NULL,
    selected_external_id VARCHAR(255) NOT NULL,
    candidate_fingerprint VARCHAR(64) NOT NULL,
    selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source, dataset_key, canonical_key)
);

CREATE TABLE catalog.sync_conflicts (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    run_id BIGINT NOT NULL REFERENCES catalog.sync_runs(id) ON DELETE CASCADE,
    source VARCHAR(40) NOT NULL,
    dataset_key VARCHAR(80) NOT NULL,
    canonical_key VARCHAR(700) NOT NULL,
    family VARCHAR(40) NOT NULL,
    name VARCHAR(255) NOT NULL,
    manufacturer VARCHAR(180),
    candidate_fingerprint VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    selected_external_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT uk_catalog_sync_conflict UNIQUE (run_id, source, dataset_key, canonical_key),
    CONSTRAINT chk_catalog_sync_conflict_status CHECK (status IN ('PENDING', 'RESOLVED'))
);

CREATE INDEX idx_catalog_sync_conflicts_pending
    ON catalog.sync_conflicts (run_id, status);

CREATE TABLE catalog.sync_conflict_candidates (
    conflict_id BIGINT NOT NULL REFERENCES catalog.sync_conflicts(id) ON DELETE CASCADE,
    external_id VARCHAR(255) NOT NULL,
    slug VARCHAR(280),
    image_url TEXT,
    image_is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    source_url TEXT,
    source_payload JSONB NOT NULL,
    PRIMARY KEY (conflict_id, external_id)
);
