ALTER TABLE catalog.entries
    ADD COLUMN focus VARCHAR(160),
    ADD COLUMN scu INTEGER,
    ADD COLUMN size VARCHAR(80),
    ADD COLUMN crew VARCHAR(40),
    ADD COLUMN flight_ready BOOLEAN;

ALTER TABLE catalog.entries
    ADD CONSTRAINT chk_catalog_entries_scu
        CHECK (scu IS NULL OR scu >= 0);

CREATE TABLE catalog.cargo_grids (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    entry_id BIGINT NOT NULL,
    size_x INTEGER NOT NULL CHECK (size_x > 0),
    size_y INTEGER NOT NULL CHECK (size_y > 0),
    size_z INTEGER NOT NULL CHECK (size_z > 0),
    source VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_catalog_cargo_grids_entry
        FOREIGN KEY (entry_id) REFERENCES catalog.entries(id) ON DELETE CASCADE,
    CONSTRAINT uk_catalog_cargo_grids_entry_dimensions
        UNIQUE (entry_id, size_x, size_y, size_z)
);

CREATE INDEX idx_catalog_cargo_grids_entry_id
    ON catalog.cargo_grids(entry_id);

CREATE TABLE catalog.legacy_ship_mappings (
    legacy_ship_id BIGINT PRIMARY KEY,
    entry_id BIGINT NOT NULL,
    legacy_name VARCHAR(100) NOT NULL,
    catalog_name VARCHAR(255) NOT NULL,
    match_method VARCHAR(40) NOT NULL,
    mapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_legacy_ship_mapping_legacy
        FOREIGN KEY (legacy_ship_id) REFERENCES fleet.ships(id) ON DELETE CASCADE,
    CONSTRAINT fk_legacy_ship_mapping_entry
        FOREIGN KEY (entry_id) REFERENCES catalog.entries(id)
);

CREATE INDEX idx_legacy_ship_mappings_entry_id
    ON catalog.legacy_ship_mappings(entry_id);
