ALTER TABLE events.operations
    ADD COLUMN IF NOT EXISTS allow_ship_proposals BOOLEAN NOT NULL DEFAULT FALSE;
