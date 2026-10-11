ALTER TABLE events.operation_ship_proposals
    ADD COLUMN IF NOT EXISTS pilot_user_id UUID REFERENCES core.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS operation_ship_proposals_pilot_idx
    ON events.operation_ship_proposals(pilot_user_id);
