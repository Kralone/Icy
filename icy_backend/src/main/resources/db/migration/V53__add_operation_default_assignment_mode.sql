ALTER TABLE events.operations
    ADD COLUMN IF NOT EXISTS default_assignment_mode VARCHAR(20) NOT NULL DEFAULT 'FREE';

ALTER TABLE events.operations
    ADD CONSTRAINT operations_default_assignment_mode_ck CHECK (default_assignment_mode IN ('FREE', 'VALIDATION', 'MANAGED'));
