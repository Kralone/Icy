ALTER TABLE core.users
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'CONNECTE',
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512),
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS favorite_ship_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_user_favorite_ship'
          AND table_schema = 'core'
          AND table_name = 'users'
    ) THEN
        ALTER TABLE core.users
            ADD CONSTRAINT fk_user_favorite_ship
                FOREIGN KEY (favorite_ship_id)
                REFERENCES fleet.ships(id)
                ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS core.user_params (
    user_id UUID PRIMARY KEY,
    notif_global BOOLEAN NOT NULL DEFAULT TRUE,
    notif_events BOOLEAN NOT NULL DEFAULT TRUE,
    notif_fleet BOOLEAN NOT NULL DEFAULT FALSE,
    notif_goals BOOLEAN NOT NULL DEFAULT TRUE,
    notif_discord BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_user_params_user FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'core'
          AND table_name = 'users'
          AND column_name = 'notif_global'
    ) THEN
        INSERT INTO core.user_params (user_id, notif_global, notif_events, notif_fleet, notif_goals, notif_discord)
        SELECT id,
               COALESCE(notif_global, TRUE),
               COALESCE(notif_events, TRUE),
               COALESCE(notif_fleet, FALSE),
               COALESCE(notif_goals, TRUE),
               COALESCE(notif_discord, FALSE)
        FROM core.users
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
END $$;

ALTER TABLE core.users
    DROP COLUMN IF EXISTS notif_global,
    DROP COLUMN IF EXISTS notif_events,
    DROP COLUMN IF EXISTS notif_fleet,
    DROP COLUMN IF EXISTS notif_goals,
    DROP COLUMN IF EXISTS notif_discord;
