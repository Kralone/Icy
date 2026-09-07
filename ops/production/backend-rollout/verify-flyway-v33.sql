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

    IF applied_versions <> ARRAY(SELECT generate_series(1, 33)) THEN
        RAISE EXCEPTION
            'Flyway history invalid: successful V1-V33 expected, got %',
            applied_versions;
    END IF;

    IF EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE NOT success) THEN
        RAISE EXCEPTION 'Flyway history invalid: failed migration found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.flyway_schema_history
        WHERE version = '33'
          AND description = 'allow multiple catalog conflict selections'
          AND script = 'V33__allow_multiple_catalog_conflict_selections.sql'
          AND success
    ) THEN
        RAISE EXCEPTION 'Flyway V33 metadata is invalid';
    END IF;

    IF to_regclass('catalog.canonical_selections') IS NULL
       OR to_regclass('catalog.sync_conflicts') IS NULL
       OR to_regclass('catalog.sync_conflict_candidates') IS NULL
       OR to_regclass('catalog.sync_conflict_selections') IS NULL THEN
        RAISE EXCEPTION 'V33 catalog conflict tables are incomplete';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'catalog.canonical_selections'::regclass
          AND conname = 'canonical_selections_pkey'
          AND pg_get_constraintdef(oid) =
              'PRIMARY KEY (source, dataset_key, canonical_key, selected_external_id)'
    ) THEN
        RAISE EXCEPTION 'V33 canonical selection primary key is invalid';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'catalog.sync_conflict_selections'::regclass
          AND conname = 'fk_catalog_sync_conflict_selection_candidate'
          AND contype = 'f'
    ) THEN
        RAISE EXCEPTION 'V33 conflict selection candidate foreign key is missing';
    END IF;
END
$verify$;

SELECT 'FLYWAY_V33_PRODUCTION_OK' AS result;

ROLLBACK;
