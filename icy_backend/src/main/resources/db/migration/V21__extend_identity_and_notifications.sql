ALTER TABLE core.users
    ADD COLUMN description TEXT,
    ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'CONNECTE',
    ADD COLUMN avatar_url VARCHAR(512),
    ADD COLUMN last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN favorite_ship_id BIGINT,
    ADD CONSTRAINT fk_user_favorite_ship
        FOREIGN KEY (favorite_ship_id) REFERENCES fleet.ships(id) ON DELETE SET NULL;

CREATE TABLE core.user_params (
    user_id UUID PRIMARY KEY,
    notif_global BOOLEAN NOT NULL DEFAULT TRUE,
    notif_events BOOLEAN NOT NULL DEFAULT TRUE,
    notif_fleet BOOLEAN NOT NULL DEFAULT FALSE,
    notif_goals BOOLEAN NOT NULL DEFAULT TRUE,
    notif_discord BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_user_params_user
        FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE
);

CREATE TABLE core.notification_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_subscriptions_user_id
    ON core.notification_subscriptions(user_id);

INSERT INTO core.roles (name)
VALUES ('JUNIOR'),
       ('ASSOCIE'),
       ('INGENIEUR'),
       ('SPECIALISTE'),
       ('OFFICIER'),
       ('ADMIN')
ON CONFLICT (name) DO NOTHING;
