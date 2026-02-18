CREATE TABLE IF NOT EXISTS utils.exec_hangar_config (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    initial_open_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by_user_id UUID NULL,
    CONSTRAINT fk_exec_hangar_config_updated_by
        FOREIGN KEY (updated_by_user_id)
            REFERENCES core.users(id)
            ON DELETE SET NULL
);

INSERT INTO utils.exec_hangar_config (id, initial_open_time)
VALUES (1, '2026-02-01 17:09:54.775')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS utils.exec_hangar_player_status (
    user_id UUID PRIMARY KEY,
    has_exec_ship BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
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

CREATE INDEX IF NOT EXISTS idx_exec_hangar_player_status_ship
    ON utils.exec_hangar_player_status (has_exec_ship);
