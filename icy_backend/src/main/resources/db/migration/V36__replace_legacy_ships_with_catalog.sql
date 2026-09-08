-- The canonical catalog becomes the only ship source.
-- Existing fleets are intentionally reset: members will rebuild them.

LOCK TABLE fleet.ships, fleet.user_ships, fleet.ship_sale_points,
    fleet.ship_cargo_grids, core.users, mining.mining_sheet_ships
    IN SHARE ROW EXCLUSIVE MODE;

DELETE FROM fleet.user_ships;
UPDATE core.users SET favorite_ship_id = NULL WHERE favorite_ship_id IS NOT NULL;
DELETE FROM mining.mining_sheet_ships;

DO $$
DECLARE
    constraint_row RECORD;
BEGIN
    FOR constraint_row IN
        SELECT conrelid::regclass AS table_name, conname
          FROM pg_constraint
         WHERE contype = 'f'
           AND confrelid = 'fleet.ships'::regclass
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

CREATE VIEW catalog.ship_compat AS
SELECT e.id,
       e.name,
       b.id AS brand_id,
       e.focus,
       e.scu,
       e.size,
       e.crew,
       COALESCE(e.flight_ready, FALSE) AS flight_ready,
       e.image_url,
       e.description AS notes
  FROM catalog.entries e
  JOIN fleet.brand b
    ON lower(trim(b.name)) = lower(trim(CASE
        WHEN e.manufacturer = 'Musashi Industrial and Starflight Concern' THEN 'MISC'
        ELSE e.manufacturer
    END))
 WHERE e.active
   AND e.family IN ('SHIP', 'GROUND_VEHICLE');

CREATE VIEW catalog.ship_sale_point_compat AS
SELECT o.id,
       o.entry_id AS ship_id,
       o.location_name::VARCHAR(120) AS location,
       o.price::NUMERIC(12, 2) AS price
  FROM catalog.offers o
 WHERE o.active
   AND o.offer_type = 'BUY'
   AND o.entry_id IS NOT NULL;

CREATE VIEW catalog.ship_cargo_grid_compat AS
SELECT g.id,
       g.entry_id AS ship_id,
       g.size_x,
       g.size_y,
       g.size_z
  FROM catalog.cargo_grids g;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM fleet.user_ships)
       OR EXISTS (SELECT 1 FROM core.users WHERE favorite_ship_id IS NOT NULL)
       OR EXISTS (SELECT 1 FROM mining.mining_sheet_ships) THEN
        RAISE EXCEPTION 'La remise a zero des references vaisseaux est incomplete';
    END IF;
END
$$;
