ALTER TABLE events.operation_groups
    ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES core.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS operation_groups_responsible_idx
    ON events.operation_groups(responsible_user_id);
