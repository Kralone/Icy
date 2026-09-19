-- Consolidated resources catalogue migration.
-- V33-V37 were development/staging-only and are reconciled explicitly by ops.
-- PostgreSQL runs this entire migration in one transaction.

-- Provenance metadata for economy, refinery and mining datasets.
-- A nullable version is intentional: UEX does not expose it for every endpoint.
ALTER TABLE utils.uex_dataset_cache
    ADD COLUMN IF NOT EXISTS game_version VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_uex_dataset_cache_game_version
    ON utils.uex_dataset_cache (game_version);

ALTER TABLE ore_locations
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS game_version VARCHAR(20);

COMMENT ON COLUMN ore_locations.source_url IS 'Source de l import des ore locations, nullable quand le fichier est fourni manuellement.';
COMMENT ON COLUMN ore_locations.game_version IS 'Version du jeu associée au lot, nullable si la source ne la fournit pas.';

ALTER TABLE ore_locations ALTER COLUMN users_count DROP NOT NULL, ALTER COLUMN users_count DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN scans_count DROP NOT NULL, ALTER COLUMN scans_count DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN clusters_count DROP NOT NULL, ALTER COLUMN clusters_count DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN cluster_count_min DROP NOT NULL, ALTER COLUMN cluster_count_min DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN cluster_count_max DROP NOT NULL, ALTER COLUMN cluster_count_max DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN cluster_count_med DROP NOT NULL, ALTER COLUMN cluster_count_med DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN mass_min DROP NOT NULL, ALTER COLUMN mass_min DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN mass_max DROP NOT NULL, ALTER COLUMN mass_max DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN mass_med DROP NOT NULL, ALTER COLUMN mass_med DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN inst_min DROP NOT NULL, ALTER COLUMN inst_min DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN inst_max DROP NOT NULL, ALTER COLUMN inst_max DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN inst_med DROP NOT NULL, ALTER COLUMN inst_med DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN res_min DROP NOT NULL, ALTER COLUMN res_min DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN res_max DROP NOT NULL, ALTER COLUMN res_max DROP DEFAULT;
ALTER TABLE ore_locations ALTER COLUMN res_med DROP NOT NULL, ALTER COLUMN res_med DROP DEFAULT;
ALTER TABLE ore_location_ores ALTER COLUMN probability DROP NOT NULL, ALTER COLUMN probability DROP DEFAULT;
ALTER TABLE ore_location_ores ALTER COLUMN min_pct DROP NOT NULL, ALTER COLUMN min_pct DROP DEFAULT;
ALTER TABLE ore_location_ores ALTER COLUMN max_pct DROP NOT NULL, ALTER COLUMN max_pct DROP DEFAULT;
ALTER TABLE ore_location_ores ALTER COLUMN med_pct DROP NOT NULL, ALTER COLUMN med_pct DROP DEFAULT;

ALTER TABLE catalog.entries DROP CONSTRAINT chk_catalog_entry_family;
ALTER TABLE catalog.entries ADD CONSTRAINT chk_catalog_entry_family CHECK (family IN (
    'SHIP', 'GROUND_VEHICLE', 'POWER_SUIT', 'FPS_WEAPON', 'SHIP_WEAPON',
    'ARMOR', 'SHIP_COMPONENT', 'MODULE', 'TOOL', 'ITEM', 'SYSTEM',
    'PLANET', 'MOON', 'CITY', 'STATION', 'JUMP_POINT', 'OUTPOST', 'LOCATION', 'COMMODITY'
));

ALTER TABLE catalog.sync_runs DROP CONSTRAINT chk_catalog_sync_scope;
ALTER TABLE catalog.sync_runs ADD CONSTRAINT chk_catalog_sync_scope
    CHECK (scope IS NULL OR scope IN ('VEHICLES', 'ITEMS', 'LOCATIONS', 'COMMODITIES', 'ECONOMY', 'WIKELO'));
