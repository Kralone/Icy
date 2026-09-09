\set ON_ERROR_STOP on

-- Complete the physical catalog cutover on an environment stopped at the
-- former Flyway V36. Flyway history is reconciled separately afterwards.
BEGIN;

DO $preflight$
DECLARE
    applied_versions integer[];
BEGIN
    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO applied_versions
    FROM public.flyway_schema_history
    WHERE success;

    IF applied_versions <> ARRAY(SELECT generate_series(1, 36)) THEN
        RAISE EXCEPTION 'Expected the former successful V1-V36 history, got %', applied_versions;
    END IF;

    IF EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE NOT success) THEN
        RAISE EXCEPTION 'Failed Flyway migration found';
    END IF;

    IF to_regclass('fleet.ships') IS NULL
       OR to_regclass('catalog.legacy_ship_mappings') IS NULL
       OR to_regclass('catalog.ship_compat') IS NULL THEN
        RAISE EXCEPTION 'The physical V36 compatibility state is incomplete';
    END IF;
END
$preflight$;

LOCK TABLE fleet.ships, fleet.user_ships, fleet.ship_sale_points,
    fleet.ship_cargo_grids, core.users, mining.mining_sheet_ships
    IN SHARE ROW EXCLUSIVE MODE;

DELETE FROM fleet.user_ships;
UPDATE core.users SET favorite_ship_id = NULL WHERE favorite_ship_id IS NOT NULL;
DELETE FROM mining.mining_sheet_ships;

DROP TABLE catalog.legacy_ship_mappings;

DO $$
DECLARE
    constraint_row RECORD;
BEGIN
    FOR constraint_row IN
        SELECT DISTINCT c.conrelid::regclass AS table_name, c.conname
        FROM pg_constraint c
        WHERE c.contype = 'f'
          AND (
              c.confrelid = 'fleet.ships'::regclass
              OR (
                  c.conrelid = 'fleet.user_ships'::regclass
                  AND (SELECT attnum FROM pg_attribute
                       WHERE attrelid = c.conrelid AND attname = 'ship_id') = ANY (c.conkey)
              )
              OR (
                  c.conrelid = 'core.users'::regclass
                  AND (SELECT attnum FROM pg_attribute
                       WHERE attrelid = c.conrelid AND attname = 'favorite_ship_id') = ANY (c.conkey)
              )
              OR (
                  c.conrelid = 'mining.mining_sheet_ships'::regclass
                  AND (SELECT attnum FROM pg_attribute
                       WHERE attrelid = c.conrelid AND attname = 'ship_id') = ANY (c.conkey)
              )
          )
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', constraint_row.table_name, constraint_row.conname);
    END LOOP;
END
$$;

DROP TABLE fleet.ship_sale_points;
DROP TABLE fleet.ship_cargo_grids;
DROP TABLE fleet.ships;

ALTER TABLE fleet.user_ships
    ADD CONSTRAINT fk_user_ships_catalog_entry
        FOREIGN KEY (ship_id) REFERENCES catalog.entries(id) ON DELETE CASCADE;
ALTER TABLE core.users
    ADD CONSTRAINT fk_user_favorite_catalog_entry
        FOREIGN KEY (favorite_ship_id) REFERENCES catalog.entries(id) ON DELETE SET NULL;
ALTER TABLE mining.mining_sheet_ships
    ADD CONSTRAINT fk_mining_sheet_ships_catalog_entry
        FOREIGN KEY (ship_id) REFERENCES catalog.entries(id);

CREATE OR REPLACE VIEW catalog.ship_compat AS
SELECT e.id, e.name, b.id AS brand_id, e.focus, e.scu, e.size, e.crew,
       COALESCE(e.flight_ready, FALSE) AS flight_ready,
       e.image_url, e.description AS notes
FROM catalog.entries e
JOIN fleet.brand b
  ON lower(trim(b.name)) = lower(trim(CASE
      WHEN e.manufacturer = 'Musashi Industrial and Starflight Concern' THEN 'MISC'
      ELSE e.manufacturer
  END))
WHERE e.active AND e.family IN ('SHIP', 'GROUND_VEHICLE');

CREATE OR REPLACE VIEW catalog.ship_sale_point_compat AS
SELECT o.id, o.entry_id AS ship_id,
       o.location_name::VARCHAR(120) AS location,
       o.price::NUMERIC(12, 2) AS price
FROM catalog.offers o
WHERE o.active AND o.offer_type = 'BUY' AND o.entry_id IS NOT NULL;

CREATE OR REPLACE VIEW catalog.ship_cargo_grid_compat AS
SELECT id, entry_id AS ship_id, size_x, size_y, size_z
FROM catalog.cargo_grids;

DO $verify$
BEGIN
    IF EXISTS (SELECT 1 FROM fleet.user_ships)
       OR EXISTS (SELECT 1 FROM core.users WHERE favorite_ship_id IS NOT NULL)
       OR EXISTS (SELECT 1 FROM mining.mining_sheet_ships) THEN
        RAISE EXCEPTION 'The ship reference reset is incomplete';
    END IF;

    IF to_regclass('fleet.ships') IS NOT NULL
       OR to_regclass('fleet.ship_sale_points') IS NOT NULL
       OR to_regclass('fleet.ship_cargo_grids') IS NOT NULL
       OR to_regclass('catalog.legacy_ship_mappings') IS NOT NULL THEN
        RAISE EXCEPTION 'The legacy ship storage removal is incomplete';
    END IF;
END
$verify$;

COMMIT;

SELECT 'FLYWAY_V36_SCHEMA_FINALIZATION_OK' AS result;
