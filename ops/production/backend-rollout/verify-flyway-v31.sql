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

    IF applied_versions <> ARRAY(SELECT generate_series(1, 31)) THEN
        RAISE EXCEPTION
            'Flyway history invalid: successful V1-V31 expected, got %',
            applied_versions;
    END IF;

    IF EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE NOT success) THEN
        RAISE EXCEPTION 'Flyway history invalid: failed migration found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.flyway_schema_history
        WHERE version = '31'
          AND description = 'create external catalog sync'
          AND script = 'V31__create_external_catalog_sync.sql'
          AND success
    ) THEN
        RAISE EXCEPTION 'Flyway V31 metadata is invalid';
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
        RAISE EXCEPTION 'No active administrator remains after V31';
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

    IF to_regclass('catalog.sync_runs') IS NULL
       OR to_regclass('catalog.raw_records') IS NULL
       OR to_regclass('catalog.entries') IS NULL
       OR to_regclass('catalog.offers') IS NULL THEN
        RAISE EXCEPTION 'V31 catalog tables are incomplete';
    END IF;

    IF to_regclass('catalog.uk_catalog_sync_one_active_run') IS NULL
       OR to_regclass('catalog.uk_catalog_raw_source_dataset_external') IS NULL
       OR to_regclass('catalog.uk_catalog_entry_source_external') IS NULL
       OR to_regclass('catalog.uk_catalog_offer_source_external') IS NULL THEN
        RAISE EXCEPTION 'V31 catalog uniqueness guarantees are incomplete';
    END IF;
END
$verify$;

SELECT 'FLYWAY_V31_PRODUCTION_OK' AS result;

ROLLBACK;
