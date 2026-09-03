\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

DO $verify$
DECLARE
    current_version integer;
    unusable_event_types bigint;
    legacy_type_exists boolean;
BEGIN
    SELECT max(version::integer)
    INTO current_version
    FROM public.flyway_schema_history
    WHERE success;

    IF current_version NOT IN (28, 29) THEN
        RAISE EXCEPTION
            'V30 preflight refused: expected Flyway V28 or V29, got %',
            current_version;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'events'
          AND table_name = 'events'
          AND column_name = 'type'
    ) INTO legacy_type_exists;

    IF legacy_type_exists THEN
        EXECUTE $sql$
            SELECT count(*)
            FROM events.events
            WHERE event_type IS NULL
              AND (type IS NULL OR btrim(type) = '')
        $sql$ INTO unusable_event_types;
    ELSE
        SELECT count(*)
        INTO unusable_event_types
        FROM events.events
        WHERE event_type IS NULL;
    END IF;

    IF unusable_event_types <> 0 THEN
        RAISE EXCEPTION
            'V30 preflight refused: % event rows have no usable type',
            unusable_event_types;
    END IF;
END
$verify$;

SELECT 'V30_EVENT_TYPE_READINESS_OK' AS result;

ROLLBACK;
