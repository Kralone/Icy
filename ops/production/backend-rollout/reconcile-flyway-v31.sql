\set ON_ERROR_STOP on

-- Reconcile an environment that applied the former V31-V36 or V31-V37 series.
-- A V36 environment must first execute finalize-flyway-v36-schema.sql.
-- Run only after a verified database backup and while the backend is stopped.
BEGIN;

LOCK TABLE public.flyway_schema_history IN ACCESS EXCLUSIVE MODE;

DO $preflight$
DECLARE
    applied_versions integer[];
BEGIN
    IF to_regclass('public.flyway_schema_history_pre_v31_consolidation') IS NOT NULL THEN
        RAISE EXCEPTION 'Flyway V31 reconciliation backup already exists';
    END IF;

    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO applied_versions
    FROM public.flyway_schema_history
    WHERE success;

    IF applied_versions <> ARRAY(SELECT generate_series(1, 36))
       AND applied_versions <> ARRAY(SELECT generate_series(1, 37)) THEN
        RAISE EXCEPTION 'Expected the former successful V1-V36 or V1-V37 history, got %', applied_versions;
    END IF;

    IF EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE NOT success) THEN
        RAISE EXCEPTION 'Failed Flyway migration found';
    END IF;

    IF to_regclass('catalog.entries') IS NULL
       OR to_regclass('catalog.sync_conflicts') IS NULL
       OR to_regclass('catalog.sync_conflict_selections') IS NULL
       OR to_regclass('catalog.cargo_grids') IS NULL
       OR to_regclass('catalog.ship_compat') IS NULL THEN
        RAISE EXCEPTION 'The physical V37 catalog schema is incomplete';
    END IF;

    IF to_regclass('fleet.ships') IS NOT NULL
       OR to_regclass('fleet.ship_sale_points') IS NOT NULL
       OR to_regclass('fleet.ship_cargo_grids') IS NOT NULL
       OR to_regclass('catalog.legacy_ship_mappings') IS NOT NULL THEN
        RAISE EXCEPTION 'The physical V37 cutover is incomplete';
    END IF;

    IF EXISTS (SELECT 1 FROM fleet.user_ships)
       OR EXISTS (SELECT 1 FROM core.users WHERE favorite_ship_id IS NOT NULL)
       OR EXISTS (SELECT 1 FROM mining.mining_sheet_ships) THEN
        RAISE EXCEPTION 'The physical V37 ship reference reset is incomplete';
    END IF;
END
$preflight$;

CREATE TABLE public.flyway_schema_history_pre_v31_consolidation
AS TABLE public.flyway_schema_history WITH DATA;

UPDATE public.flyway_schema_history
SET description = 'consolidate catalog cutover',
    script = 'V31__consolidate_catalog_cutover.sql',
    checksum = -300817490,
    execution_time = 0
WHERE version = '31'
  AND success;

DELETE FROM public.flyway_schema_history
WHERE version::integer BETWEEN 32 AND 37;

DO $verify$
DECLARE
    applied_versions integer[];
    backup_versions integer[];
BEGIN
    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO applied_versions
    FROM public.flyway_schema_history
    WHERE success;

    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO backup_versions
    FROM public.flyway_schema_history_pre_v31_consolidation
    WHERE success;

    IF applied_versions <> ARRAY(SELECT generate_series(1, 31)) THEN
        RAISE EXCEPTION 'Reconciled Flyway history is invalid: %', applied_versions;
    END IF;

    IF backup_versions <> ARRAY(SELECT generate_series(1, 36))
       AND backup_versions <> ARRAY(SELECT generate_series(1, 37)) THEN
        RAISE EXCEPTION 'Flyway history backup is invalid: %', backup_versions;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.flyway_schema_history
        WHERE version = '31'
          AND description = 'consolidate catalog cutover'
          AND script = 'V31__consolidate_catalog_cutover.sql'
          AND checksum = -300817490
          AND success
    ) THEN
        RAISE EXCEPTION 'Reconciled Flyway V31 metadata is invalid';
    END IF;
END
$verify$;

COMMIT;

SELECT 'FLYWAY_V31_RECONCILIATION_OK' AS result;
