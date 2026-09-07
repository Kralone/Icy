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

    IF applied_versions <> ARRAY(SELECT generate_series(1, 32)) THEN
        RAISE EXCEPTION
            'Flyway history invalid: successful V1-V32 expected, got %',
            applied_versions;
    END IF;

    IF EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE NOT success) THEN
        RAISE EXCEPTION 'Flyway history invalid: failed migration found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.flyway_schema_history
        WHERE version = '32'
          AND description = 'create catalog conflict review'
          AND script = 'V32__create_catalog_conflict_review.sql'
          AND success
    ) THEN
        RAISE EXCEPTION 'Flyway V32 metadata is invalid';
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
        RAISE EXCEPTION 'No active administrator remains after V32';
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
       OR to_regclass('catalog.offers') IS NULL
       OR to_regclass('catalog.canonical_selections') IS NULL
       OR to_regclass('catalog.sync_conflicts') IS NULL
       OR to_regclass('catalog.sync_conflict_candidates') IS NULL THEN
        RAISE EXCEPTION 'V32 catalog tables are incomplete';
    END IF;

    IF to_regclass('catalog.uk_catalog_sync_one_active_run') IS NULL
       OR to_regclass('catalog.uk_catalog_raw_source_dataset_external') IS NULL
       OR to_regclass('catalog.uk_catalog_entry_source_external') IS NULL
       OR to_regclass('catalog.uk_catalog_offer_source_external') IS NULL
       OR to_regclass('catalog.idx_catalog_sync_conflicts_pending') IS NULL THEN
        RAISE EXCEPTION 'V32 catalog uniqueness and lookup guarantees are incomplete';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'catalog.sync_runs'::regclass
          AND conname = 'chk_catalog_sync_status'
          AND pg_get_constraintdef(oid) LIKE '%WAITING_FOR_REVIEW%'
    ) THEN
        RAISE EXCEPTION 'V32 sync status constraint does not allow review pauses';
    END IF;
END
$verify$;

SELECT 'FLYWAY_V32_PRODUCTION_OK' AS result;

ROLLBACK;
