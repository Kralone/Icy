CREATE TABLE IF NOT EXISTS ore_locations (
    id BIGSERIAL PRIMARY KEY,
    location_code VARCHAR(120) NOT NULL UNIQUE,
    users_count INTEGER NOT NULL DEFAULT 0,
    scans_count INTEGER NOT NULL DEFAULT 0,
    clusters_count INTEGER NOT NULL DEFAULT 0,
    cluster_count_min DOUBLE PRECISION NOT NULL DEFAULT 0,
    cluster_count_max DOUBLE PRECISION NOT NULL DEFAULT 0,
    cluster_count_med DOUBLE PRECISION NOT NULL DEFAULT 0,
    mass_min DOUBLE PRECISION NOT NULL DEFAULT 0,
    mass_max DOUBLE PRECISION NOT NULL DEFAULT 0,
    mass_med DOUBLE PRECISION NOT NULL DEFAULT 0,
    inst_min DOUBLE PRECISION NOT NULL DEFAULT 0,
    inst_max DOUBLE PRECISION NOT NULL DEFAULT 0,
    inst_med DOUBLE PRECISION NOT NULL DEFAULT 0,
    res_min DOUBLE PRECISION NOT NULL DEFAULT 0,
    res_max DOUBLE PRECISION NOT NULL DEFAULT 0,
    res_med DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ore_location_ores (
    id BIGSERIAL PRIMARY KEY,
    ore_location_id BIGINT NOT NULL,
    ore_code VARCHAR(80) NOT NULL,
    probability DOUBLE PRECISION NOT NULL DEFAULT 0,
    min_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    max_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    med_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ore_location_ores_location
        FOREIGN KEY (ore_location_id) REFERENCES ore_locations(id) ON DELETE CASCADE,
    CONSTRAINT uk_ore_location_ores_location_ore UNIQUE (ore_location_id, ore_code)
);

CREATE INDEX IF NOT EXISTS idx_ore_locations_code ON ore_locations (location_code);
CREATE INDEX IF NOT EXISTS idx_ore_location_ores_ore_code ON ore_location_ores (ore_code);
