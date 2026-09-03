\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

DO $verify$
DECLARE
    applied_versions integer[];
    safe_admin_count integer;
BEGIN
    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO applied_versions
    FROM public.flyway_schema_history
    WHERE success;

    IF applied_versions <> ARRAY(SELECT generate_series(1, 30)) THEN
        RAISE EXCEPTION
            'Flyway history invalid: successful V1-V30 expected, got %',
            applied_versions;
    END IF;

    IF EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE NOT success) THEN
        RAISE EXCEPTION 'Flyway history invalid: failed migration found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.flyway_schema_history
        WHERE version = '30'
          AND description = 'align event type column'
          AND script = 'V30__align_event_type_column.sql'
          AND success
    ) THEN
        RAISE EXCEPTION 'Flyway V30 metadata is invalid';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM core.users
        WHERE username = 'Kralone'
          AND discord_id = '190174996235026433'
          AND password = '$2a$10$7XQjzjP7aY0sIj5s3uJbcOsOL7W2PLRgfCJzfzTPd.eBoVRoZ8U6C'
    ) THEN
        RAISE EXCEPTION 'The exact public V2 credential is still present';
    END IF;

    SELECT count(DISTINCT u.id)
    INTO safe_admin_count
    FROM core.users u
    JOIN core.user_roles ur ON ur.user_id = u.id
    JOIN core.roles r ON r.id = ur.role_id
    WHERE r.name = 'ADMIN' AND u.active = true;

    IF safe_admin_count < 1 THEN
        RAISE EXCEPTION 'No active administrator remains after V30';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM events.events
        WHERE event_type IS NULL OR btrim(event_type) = ''
    ) THEN
        RAISE EXCEPTION 'V30 left an event without a usable event_type';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'events'
          AND table_name = 'events'
          AND column_name = 'event_type'
          AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'events.event_type is missing or still nullable after V30';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'events'
          AND table_name = 'events'
          AND column_name = 'type'
          AND is_nullable <> 'YES'
    ) THEN
        RAISE EXCEPTION 'legacy events.type is still NOT NULL after V30';
    END IF;
END
$verify$;

SELECT 'FLYWAY_V30_PRODUCTION_OK' AS result;

ROLLBACK;
