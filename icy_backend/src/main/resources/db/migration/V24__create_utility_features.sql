INSERT INTO icelink.icelink_block (name, icon, content, description, headline)
SELECT 'Nouveaux membres', '🆕', 'Auto', NULL, '## 🆕 Nouveaux membres'
WHERE NOT EXISTS (
    SELECT 1 FROM icelink.icelink_block WHERE name = 'Nouveaux membres'
);

INSERT INTO icelink.icelink_block (name, icon, content, description, headline)
SELECT 'Nouveaux vaisseaux', '🚀', 'Auto', NULL, '## 🚀 Nouveaux vaisseaux'
WHERE NOT EXISTS (
    SELECT 1 FROM icelink.icelink_block WHERE name = 'Nouveaux vaisseaux'
);

CREATE SCHEMA utils;

CREATE TABLE utils.wikelo_ships (
    id BIGSERIAL PRIMARY KEY,
    ship_name VARCHAR(255) NOT NULL UNIQUE,
    mission_text TEXT,
    cost_text TEXT,
    reputation_text TEXT,
    components_text TEXT,
    source_sheet VARCHAR(120) NOT NULL,
    source_url TEXT NOT NULL,
    scraped_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE utils.exec_hangar_config (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    initial_open_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by_user_id UUID NULL,
    CONSTRAINT fk_exec_hangar_config_updated_by
        FOREIGN KEY (updated_by_user_id)
            REFERENCES core.users(id)
            ON DELETE SET NULL
);

INSERT INTO utils.exec_hangar_config (id, initial_open_time)
VALUES (1, '2026-02-01T17:09:54.775-05:00'::timestamptz)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE utils.exec_hangar_player_status (
    user_id UUID PRIMARY KEY,
    has_exec_ship BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by_user_id UUID NULL,
    CONSTRAINT fk_exec_hangar_player_status_user
        FOREIGN KEY (user_id)
            REFERENCES core.users(id)
            ON DELETE CASCADE,
    CONSTRAINT fk_exec_hangar_player_status_updated_by
        FOREIGN KEY (updated_by_user_id)
            REFERENCES core.users(id)
            ON DELETE SET NULL
);

CREATE INDEX idx_exec_hangar_player_status_ship
    ON utils.exec_hangar_player_status (has_exec_ship);

CREATE TABLE utils.uex_dataset_cache (
    dataset_key VARCHAR(80) PRIMARY KEY,
    source_url TEXT NOT NULL,
    payload JSONB NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 0,
    fetched_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uex_dataset_cache_fetched_at
    ON utils.uex_dataset_cache (fetched_at DESC);
