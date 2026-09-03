-- V7 introduced events.event_type, but the legacy events.type column from V6
-- remained NOT NULL. Modern versions of the backend only write event_type, so
-- a valid event creation could still fail on the obsolete column.
--
-- Keep the legacy column nullable for rollback compatibility. A later release
-- may remove it once no deployed version depends on it.

DO $migration$
BEGIN
    -- Some production histories removed the legacy column manually before
    -- Flyway V30 existed. PostgreSQL resolves column names while executing a
    -- statement, so keep every legacy-column reference in dynamic SQL.
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'events'
          AND table_name = 'events'
          AND column_name = 'type'
    ) THEN
        EXECUTE $sql$
            INSERT INTO events.event_types (name)
            SELECT DISTINCT btrim(type)
            FROM events.events
            WHERE type IS NOT NULL
              AND btrim(type) <> ''
            ON CONFLICT (name) DO NOTHING
        $sql$;

        EXECUTE $sql$
            UPDATE events.events
            SET event_type = btrim(type)
            WHERE event_type IS NULL
              AND type IS NOT NULL
              AND btrim(type) <> ''
        $sql$;
    END IF;

    IF EXISTS (SELECT 1 FROM events.events WHERE event_type IS NULL) THEN
        RAISE EXCEPTION
            'V30 cannot enforce events.event_type: at least one event has no usable type';
    END IF;
END
$migration$;

ALTER TABLE events.events
    ALTER COLUMN event_type SET NOT NULL;

DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'events'
          AND table_name = 'events'
          AND column_name = 'type'
    ) THEN
        ALTER TABLE events.events ALTER COLUMN type DROP NOT NULL;
    END IF;
END
$migration$;
