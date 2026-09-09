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

    IF applied_versions <> ARRAY(SELECT generate_series(1, 36)) THEN
        RAISE EXCEPTION 'Flyway history invalid: successful V1-V36 expected, got %', applied_versions;
    END IF;

    IF EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE NOT success) THEN
        RAISE EXCEPTION 'Flyway history invalid: failed migration found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.flyway_schema_history
         WHERE version = '36'
           AND description = 'remap ship references to catalog'
           AND script = 'V36__remap_ship_references_to_catalog.sql'
           AND success
    ) THEN
        RAISE EXCEPTION 'Flyway V36 metadata is invalid';
    END IF;

    IF to_regclass('fleet.ships') IS NULL
       OR to_regclass('catalog.legacy_ship_mappings') IS NULL
       OR to_regclass('catalog.ship_compat') IS NULL THEN
        RAISE EXCEPTION 'V36 legacy compatibility state is incomplete';
    END IF;
END
$verify$;

SELECT 'FLYWAY_V36_PRODUCTION_OK' AS result;

ROLLBACK;
