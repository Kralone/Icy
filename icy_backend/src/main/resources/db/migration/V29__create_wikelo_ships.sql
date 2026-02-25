CREATE SCHEMA IF NOT EXISTS utils;

CREATE TABLE IF NOT EXISTS utils.wikelo_ships (
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
