-- V7 introduced events.event_type, but the legacy events.type column from V6
-- remained NOT NULL. Modern versions of the backend only write event_type, so
-- a valid event creation could still fail on the obsolete column.
--
-- Keep the legacy column nullable for rollback compatibility. A later release
-- may remove it once no deployed version depends on it.

INSERT INTO events.event_types (name)
SELECT DISTINCT btrim(type)
FROM events.events
WHERE type IS NOT NULL
  AND btrim(type) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE events.events
SET event_type = btrim(type)
WHERE event_type IS NULL
  AND type IS NOT NULL
  AND btrim(type) <> '';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM events.events WHERE event_type IS NULL) THEN
        RAISE EXCEPTION
            'V30 cannot enforce events.event_type: at least one event has no usable type';
    END IF;
END
$$;

ALTER TABLE events.events
    ALTER COLUMN event_type SET NOT NULL,
    ALTER COLUMN type DROP NOT NULL;
