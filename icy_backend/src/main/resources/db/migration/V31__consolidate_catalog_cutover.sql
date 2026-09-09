-- Consolidated catalog cutover. This migration replaces the former V31-V37
-- development series so the whole schema and data transition is atomic.

CREATE SCHEMA catalog;

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
        CHECK (status IN ('QUEUED', 'RUNNING', 'WAITING_FOR_REVIEW', 'SUCCEEDED', 'FAILED'))
);

CREATE UNIQUE INDEX uk_catalog_sync_one_active_run
    ON catalog.sync_runs ((1))
    WHERE status IN ('QUEUED', 'RUNNING', 'WAITING_FOR_REVIEW');

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
    last_seen_run_id BIGINT NOT NULL REFERENCES catalog.sync_runs(id),
    CONSTRAINT uk_catalog_raw_source_dataset_external UNIQUE (source, dataset_key, external_id)
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
    catalog_group VARCHAR(24) NOT NULL DEFAULT 'STANDARD',
    focus VARCHAR(160),
    scu INTEGER,
    size VARCHAR(80),
    crew VARCHAR(40),
    flight_ready BOOLEAN,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_run_id BIGINT NOT NULL REFERENCES catalog.sync_runs(id),
    CONSTRAINT uk_catalog_entry_source_external UNIQUE (source, external_id),
    CONSTRAINT chk_catalog_entry_family CHECK (family IN (
        'SHIP', 'GROUND_VEHICLE', 'POWER_SUIT', 'FPS_WEAPON', 'SHIP_WEAPON',
        'ARMOR', 'SHIP_COMPONENT', 'MODULE', 'TOOL', 'ITEM', 'SYSTEM',
        'PLANET', 'MOON', 'CITY', 'STATION', 'JUMP_POINT', 'OUTPOST', 'LOCATION'
    )),
    CONSTRAINT chk_catalog_entry_group
        CHECK (catalog_group IN ('STANDARD', 'WIKELO', 'PYAM_EXEC', 'BATTAGLIA')),
    CONSTRAINT chk_catalog_entries_scu CHECK (scu IS NULL OR scu >= 0)
);

CREATE INDEX idx_catalog_entries_family_name
    ON catalog.entries (family, active, name);
CREATE INDEX idx_catalog_entries_dataset_active
    ON catalog.entries (source, dataset_key, active);
CREATE INDEX idx_catalog_entries_group_family
    ON catalog.entries (catalog_group, family, active, name);

CREATE TABLE catalog.offers (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    source VARCHAR(40) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    entry_id BIGINT REFERENCES catalog.entries(id) ON DELETE SET NULL,
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
    last_seen_run_id BIGINT NOT NULL REFERENCES catalog.sync_runs(id),
    CONSTRAINT uk_catalog_offer_source_external UNIQUE (source, external_id),
    CONSTRAINT chk_catalog_offer_type CHECK (offer_type IN ('BUY', 'SELL', 'RENT', 'WIKELO'))
);

CREATE INDEX idx_catalog_offers_entry_type
    ON catalog.offers (entry_id, offer_type, active);
CREATE INDEX idx_catalog_offers_unmapped
    ON catalog.offers (entity_name) WHERE entry_id IS NULL AND active;

CREATE TABLE catalog.canonical_selections (
    source VARCHAR(40) NOT NULL,
    dataset_key VARCHAR(80) NOT NULL,
    canonical_key VARCHAR(700) NOT NULL,
    selected_external_id VARCHAR(255) NOT NULL,
    candidate_fingerprint VARCHAR(64) NOT NULL,
    selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source, dataset_key, canonical_key, selected_external_id)
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

CREATE TABLE catalog.sync_conflict_selections (
    conflict_id BIGINT NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (conflict_id, external_id),
    CONSTRAINT fk_catalog_sync_conflict_selection_candidate
        FOREIGN KEY (conflict_id, external_id)
        REFERENCES catalog.sync_conflict_candidates (conflict_id, external_id)
        ON DELETE CASCADE
);

CREATE TABLE catalog.cargo_grids (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    entry_id BIGINT NOT NULL REFERENCES catalog.entries(id) ON DELETE CASCADE,
    size_x INTEGER NOT NULL CHECK (size_x > 0),
    size_y INTEGER NOT NULL CHECK (size_y > 0),
    size_z INTEGER NOT NULL CHECK (size_z > 0),
    source VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_catalog_cargo_grids_entry_dimensions UNIQUE (entry_id, size_x, size_y, size_z)
);

CREATE INDEX idx_catalog_cargo_grids_entry_id
    ON catalog.cargo_grids(entry_id);

-- The final cutover deliberately resets member ship references. Preserve the
-- legacy ship catalog itself in catalog.entries before dropping its tables.
INSERT INTO catalog.sync_runs (
    operation, scope, status, current_step, total_steps, message,
    started_at, completed_at
)
SELECT 'SCRAPE_AND_MAP', 'VEHICLES', 'SUCCEEDED', 1, 1,
       'Import transactionnel du catalogue flotte historique par Flyway V31',
       NOW(), NOW()
WHERE EXISTS (SELECT 1 FROM fleet.ships);

WITH migration_run AS (
    SELECT id FROM catalog.sync_runs
    WHERE message = 'Import transactionnel du catalogue flotte historique par Flyway V31'
    ORDER BY id DESC LIMIT 1
)
INSERT INTO catalog.entries (
    source, dataset_key, external_id, family, name, manufacturer,
    description, image_url, image_is_fallback, source_version, source_payload,
    catalog_group, focus, scu, size, crew, flight_ready, last_seen_run_id
)
SELECT 'LEGACY_FLEET', 'vehicles', 'legacy-ship:' || s.id,
       CASE WHEN s.id IN (76, 77, 185, 186, 221, 222, 223)
            THEN 'GROUND_VEHICLE' ELSE 'SHIP' END,
       s.name, b.name, s.notes,
       COALESCE(NULLIF(s.image_url, ''), '/assets/images/catalog/catalog-fallback.svg'),
       NULLIF(s.image_url, '') IS NULL, 'legacy-cutover-v1',
       jsonb_build_object('legacyShipId', s.id, 'legacyBrandId', s.brand_id),
       CASE
           WHEN LOWER(s.name) LIKE '%wikelo%' THEN 'WIKELO'
           WHEN LOWER(s.name) ~ 'pyam[[:space:]]+exec$' THEN 'PYAM_EXEC'
           WHEN LOWER(s.name) ~ '[[:space:]]+alliance$' THEN 'BATTAGLIA'
           ELSE 'STANDARD'
       END,
       s.focus, s.scu, s.size, s.crew, s.flight_ready, r.id
FROM fleet.ships s
JOIN fleet.brand b ON b.id = s.brand_id
CROSS JOIN migration_run r;

WITH migration_run AS (
    SELECT id FROM catalog.sync_runs
    WHERE message = 'Import transactionnel du catalogue flotte historique par Flyway V31'
    ORDER BY id DESC LIMIT 1
)
INSERT INTO catalog.offers (
    source, external_id, entry_id, entity_name, offer_type, location_name,
    price, currency, source_payload, last_seen_run_id
)
SELECT 'LEGACY_FLEET', 'ship-sale-point:' || p.id, e.id, s.name,
       'BUY', p.location, p.price, 'aUEC',
       jsonb_build_object('legacyShipId', s.id, 'legacySalePointId', p.id), r.id
FROM fleet.ship_sale_points p
JOIN fleet.ships s ON s.id = p.ship_id
JOIN catalog.entries e
  ON e.source = 'LEGACY_FLEET' AND e.external_id = 'legacy-ship:' || s.id
CROSS JOIN migration_run r;

INSERT INTO catalog.cargo_grids (entry_id, size_x, size_y, size_z, source)
SELECT e.id, g.size_x, g.size_y, g.size_z, 'LEGACY_FLEET'
FROM fleet.ship_cargo_grids g
JOIN catalog.entries e
  ON e.source = 'LEGACY_FLEET' AND e.external_id = 'legacy-ship:' || g.ship_id;

LOCK TABLE fleet.ships, fleet.user_ships, fleet.ship_sale_points,
    fleet.ship_cargo_grids, core.users, mining.mining_sheet_ships
    IN SHARE ROW EXCLUSIVE MODE;

DELETE FROM fleet.user_ships;
UPDATE core.users SET favorite_ship_id = NULL WHERE favorite_ship_id IS NOT NULL;
DELETE FROM mining.mining_sheet_ships;

DO $$
DECLARE
    constraint_row RECORD;
BEGIN
    FOR constraint_row IN
        SELECT DISTINCT c.conrelid::regclass AS table_name, c.conname
        FROM pg_constraint c
        WHERE c.contype = 'f'
          AND c.confrelid = 'fleet.ships'::regclass
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', constraint_row.table_name, constraint_row.conname);
    END LOOP;
END
$$;

DROP TABLE fleet.ship_sale_points;
DROP TABLE fleet.ship_cargo_grids;
DROP TABLE fleet.ships;

ALTER TABLE fleet.user_ships
    ADD CONSTRAINT fk_user_ships_catalog_entry
        FOREIGN KEY (ship_id) REFERENCES catalog.entries(id) ON DELETE CASCADE;
ALTER TABLE core.users
    ADD CONSTRAINT fk_user_favorite_catalog_entry
        FOREIGN KEY (favorite_ship_id) REFERENCES catalog.entries(id) ON DELETE SET NULL;
ALTER TABLE mining.mining_sheet_ships
    ADD CONSTRAINT fk_mining_sheet_ships_catalog_entry
        FOREIGN KEY (ship_id) REFERENCES catalog.entries(id);

CREATE VIEW catalog.ship_compat AS
SELECT e.id, e.name, b.id AS brand_id, e.focus, e.scu, e.size, e.crew,
       COALESCE(e.flight_ready, FALSE) AS flight_ready,
       e.image_url, e.description AS notes
FROM catalog.entries e
JOIN fleet.brand b
  ON lower(trim(b.name)) = lower(trim(CASE
      WHEN e.manufacturer = 'Musashi Industrial and Starflight Concern' THEN 'MISC'
      ELSE e.manufacturer
  END))
WHERE e.active AND e.family IN ('SHIP', 'GROUND_VEHICLE');

CREATE VIEW catalog.ship_sale_point_compat AS
SELECT o.id, o.entry_id AS ship_id,
       o.location_name::VARCHAR(120) AS location,
       o.price::NUMERIC(12, 2) AS price
FROM catalog.offers o
WHERE o.active AND o.offer_type = 'BUY' AND o.entry_id IS NOT NULL;

CREATE VIEW catalog.ship_cargo_grid_compat AS
SELECT id, entry_id AS ship_id, size_x, size_y, size_z
FROM catalog.cargo_grids;

DO $$
DECLARE
    legacy_ship_count BIGINT;
    imported_ship_count BIGINT;
    catalog_fk_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO legacy_ship_count
    FROM catalog.entries
    WHERE source = 'LEGACY_FLEET' AND active;

    SELECT COUNT(*) INTO imported_ship_count
    FROM catalog.entries
    WHERE source = 'LEGACY_FLEET'
      AND external_id LIKE 'legacy-ship:%';

    IF legacy_ship_count <> imported_ship_count THEN
        RAISE EXCEPTION 'V31 legacy catalog import is inconsistent';
    END IF;

    IF to_regclass('fleet.ships') IS NOT NULL
       OR to_regclass('fleet.ship_sale_points') IS NOT NULL
       OR to_regclass('fleet.ship_cargo_grids') IS NOT NULL THEN
        RAISE EXCEPTION 'V31 legacy ship storage removal is incomplete';
    END IF;

    IF EXISTS (SELECT 1 FROM fleet.user_ships)
       OR EXISTS (SELECT 1 FROM core.users WHERE favorite_ship_id IS NOT NULL)
       OR EXISTS (SELECT 1 FROM mining.mining_sheet_ships) THEN
        RAISE EXCEPTION 'V31 ship reference reset is incomplete';
    END IF;

    SELECT COUNT(*) INTO catalog_fk_count
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'catalog.entries'::regclass
      AND conname IN (
          'fk_user_ships_catalog_entry',
          'fk_user_favorite_catalog_entry',
          'fk_mining_sheet_ships_catalog_entry'
      );

    IF catalog_fk_count <> 3 THEN
        RAISE EXCEPTION 'V31 catalog ship foreign keys are incomplete: %/3', catalog_fk_count;
    END IF;
END
$$;
