CREATE SCHEMA IF NOT EXISTS catalog;

CREATE TABLE catalog.sync_runs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    operation VARCHAR(32) NOT NULL,
    scope VARCHAR(32),
    status VARCHAR(20) NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 0,
    message VARCHAR(500),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_catalog_sync_operation
        CHECK (operation IN ('SCRAPE_ALL', 'SCRAPE_AND_MAP')),
    CONSTRAINT chk_catalog_sync_scope
        CHECK (scope IS NULL OR scope IN ('VEHICLES', 'ITEMS', 'LOCATIONS', 'ECONOMY', 'WIKELO')),
    CONSTRAINT chk_catalog_sync_status
        CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'))
);

CREATE UNIQUE INDEX uk_catalog_sync_one_active_run
    ON catalog.sync_runs ((1))
    WHERE status IN ('QUEUED', 'RUNNING');

CREATE INDEX idx_catalog_sync_runs_created_at
    ON catalog.sync_runs (created_at DESC);

CREATE TABLE catalog.raw_records (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    source VARCHAR(40) NOT NULL,
    dataset_key VARCHAR(80) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    source_version VARCHAR(80),
    payload JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_run_id BIGINT NOT NULL,
    CONSTRAINT fk_catalog_raw_last_seen_run
        FOREIGN KEY (last_seen_run_id) REFERENCES catalog.sync_runs(id),
    CONSTRAINT uk_catalog_raw_source_dataset_external
        UNIQUE (source, dataset_key, external_id)
);

CREATE INDEX idx_catalog_raw_dataset_active
    ON catalog.raw_records (source, dataset_key, active);

CREATE TABLE catalog.entries (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    source VARCHAR(40) NOT NULL,
    dataset_key VARCHAR(80) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    family VARCHAR(40) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(280),
    manufacturer VARCHAR(180),
    description TEXT,
    image_url TEXT NOT NULL,
    image_is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
    source_url TEXT,
    source_version VARCHAR(80),
    source_updated_at TIMESTAMPTZ,
    source_payload JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_run_id BIGINT NOT NULL,
    CONSTRAINT fk_catalog_entry_last_seen_run
        FOREIGN KEY (last_seen_run_id) REFERENCES catalog.sync_runs(id),
    CONSTRAINT uk_catalog_entry_source_external UNIQUE (source, external_id),
    CONSTRAINT chk_catalog_entry_family CHECK (family IN (
        'SHIP', 'GROUND_VEHICLE', 'POWER_SUIT', 'FPS_WEAPON', 'SHIP_WEAPON',
        'ARMOR', 'SHIP_COMPONENT', 'MODULE', 'TOOL', 'ITEM', 'SYSTEM',
        'PLANET', 'MOON', 'CITY', 'STATION', 'JUMP_POINT', 'OUTPOST', 'LOCATION'
    ))
);

CREATE INDEX idx_catalog_entries_family_name
    ON catalog.entries (family, active, name);

CREATE INDEX idx_catalog_entries_dataset_active
    ON catalog.entries (source, dataset_key, active);

CREATE TABLE catalog.offers (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    source VARCHAR(40) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    entry_id BIGINT,
    entity_external_id VARCHAR(255),
    entity_name VARCHAR(255) NOT NULL,
    offer_type VARCHAR(20) NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    price NUMERIC(16, 4) NOT NULL CHECK (price >= 0),
    currency VARCHAR(16) NOT NULL DEFAULT 'aUEC',
    source_version VARCHAR(80),
    source_updated_at TIMESTAMPTZ,
    source_payload JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_run_id BIGINT NOT NULL,
    CONSTRAINT fk_catalog_offer_entry
        FOREIGN KEY (entry_id) REFERENCES catalog.entries(id) ON DELETE SET NULL,
    CONSTRAINT fk_catalog_offer_last_seen_run
        FOREIGN KEY (last_seen_run_id) REFERENCES catalog.sync_runs(id),
    CONSTRAINT uk_catalog_offer_source_external UNIQUE (source, external_id),
    CONSTRAINT chk_catalog_offer_type CHECK (offer_type IN ('BUY', 'SELL', 'RENT', 'WIKELO'))
);

CREATE INDEX idx_catalog_offers_entry_type
    ON catalog.offers (entry_id, offer_type, active);

CREATE INDEX idx_catalog_offers_unmapped
    ON catalog.offers (entity_name)
    WHERE entry_id IS NULL AND active;
