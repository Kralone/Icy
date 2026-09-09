\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

DO $verify$
DECLARE
    applied_versions integer[];
    expected_fk_count integer;
BEGIN
    SELECT array_agg(version::integer ORDER BY version::integer)
      INTO applied_versions
      FROM public.flyway_schema_history
     WHERE success;

    IF applied_versions <> ARRAY(SELECT generate_series(1, 37)) THEN
        RAISE EXCEPTION 'Flyway history invalid: successful V1-V37 expected, got %', applied_versions;
    END IF;

    IF EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE NOT success) THEN
        RAISE EXCEPTION 'Flyway history invalid: failed migration found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.flyway_schema_history
         WHERE version = '37'
           AND description = 'replace legacy ships with catalog'
           AND script = 'V37__replace_legacy_ships_with_catalog.sql'
           AND success
    ) THEN
        RAISE EXCEPTION 'Flyway V37 metadata is invalid';
    END IF;

    IF to_regclass('fleet.ships') IS NOT NULL
       OR to_regclass('fleet.ship_sale_points') IS NOT NULL
       OR to_regclass('fleet.ship_cargo_grids') IS NOT NULL
       OR to_regclass('catalog.legacy_ship_mappings') IS NOT NULL THEN
        RAISE EXCEPTION 'V37 legacy ship storage still exists';
    END IF;

    IF to_regclass('catalog.ship_compat') IS NULL
       OR to_regclass('catalog.ship_sale_point_compat') IS NULL
       OR to_regclass('catalog.ship_cargo_grid_compat') IS NULL THEN
        RAISE EXCEPTION 'V37 catalog compatibility views are incomplete';
    END IF;

    IF EXISTS (SELECT 1 FROM fleet.user_ships)
       OR EXISTS (SELECT 1 FROM core.users WHERE favorite_ship_id IS NOT NULL)
       OR EXISTS (SELECT 1 FROM mining.mining_sheet_ships) THEN
        RAISE EXCEPTION 'V37 ship reference reset is incomplete';
    END IF;

    SELECT count(*)
      INTO expected_fk_count
      FROM pg_constraint
     WHERE contype = 'f'
       AND confrelid = 'catalog.entries'::regclass
       AND conname IN (
           'fk_user_ships_catalog_entry',
           'fk_user_favorite_catalog_entry',
           'fk_mining_sheet_ships_catalog_entry'
       );

    IF expected_fk_count <> 3 THEN
        RAISE EXCEPTION 'V37 catalog ship foreign keys are incomplete: %/3', expected_fk_count;
    END IF;
END
$verify$;

SELECT 'FLYWAY_V37_PRODUCTION_OK' AS result;

ROLLBACK;
