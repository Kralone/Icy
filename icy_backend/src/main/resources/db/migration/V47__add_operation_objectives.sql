ALTER TABLE events.operations
    ADD COLUMN IF NOT EXISTS objectives TEXT;
