\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

DO $verify$
DECLARE
    applied_versions integer[];
BEGIN
    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO applied_versions
    FROM public.flyway_schema_history
    WHERE success;

    IF applied_versions <> ARRAY(SELECT generate_series(1, 34)) THEN
        RAISE EXCEPTION
            'Flyway history invalid: successful V1-V34 expected, got %',
            applied_versions;
    END IF;

    IF EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE NOT success) THEN
        RAISE EXCEPTION 'Flyway history invalid: failed migration found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.flyway_schema_history
        WHERE version = '34'
          AND description = 'classify catalog collections'
          AND script = 'V34__classify_catalog_collections.sql'
          AND success
    ) THEN
        RAISE EXCEPTION 'Flyway V34 metadata is invalid';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'catalog'
          AND table_name = 'entries'
          AND column_name = 'catalog_group'
          AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'V34 catalog_group column is missing or nullable';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'catalog.entries'::regclass
          AND conname = 'chk_catalog_entry_group'
          AND contype = 'c'
    ) THEN
        RAISE EXCEPTION 'V34 catalog group constraint is missing';
    END IF;

    IF to_regclass('catalog.idx_catalog_entries_group_family') IS NULL THEN
        RAISE EXCEPTION 'V34 catalog group index is missing';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM catalog.entries
        WHERE catalog_group NOT IN ('STANDARD', 'WIKELO', 'PYAM_EXEC', 'BATTAGLIA')
    ) THEN
        RAISE EXCEPTION 'V34 contains an invalid catalog group';
    END IF;
END
$verify$;

SELECT 'FLYWAY_V34_PRODUCTION_OK' AS result;

ROLLBACK;
