-- Remap all persisted ship references to catalog.entries.
-- The legacy tables remain intact until the separately approved removal step.

LOCK TABLE fleet.ships, fleet.user_ships, fleet.ship_sale_points,
    fleet.ship_cargo_grids, core.users, mining.mining_sheet_ships
    IN SHARE ROW EXCLUSIVE MODE;

WITH candidates AS (
    SELECT s.id AS legacy_ship_id,
           e.id AS entry_id,
           s.name AS legacy_name,
           e.name AS catalog_name,
           COUNT(*) OVER (PARTITION BY s.id) AS candidate_count
      FROM fleet.ships s
      JOIN catalog.entries e
        ON lower(regexp_replace(trim(e.name), '\s+', ' ', 'g')) =
           lower(regexp_replace(trim(s.name), '\s+', ' ', 'g'))
       AND e.active
       AND e.family IN ('SHIP', 'GROUND_VEHICLE')
)
INSERT INTO catalog.legacy_ship_mappings (
    legacy_ship_id, entry_id, legacy_name, catalog_name, match_method
)
SELECT legacy_ship_id, entry_id, legacy_name, catalog_name, 'NORMALIZED_NAME'
  FROM candidates
 WHERE candidate_count = 1
ON CONFLICT (legacy_ship_id) DO NOTHING;

WITH reviewed(legacy_ship_id, selected_external_id) AS (
    VALUES
        (25, 'b3d87a94-6858-4d3c-ba59-1ef29d727d1a'),
        (43, '20d5f617-147a-4530-a753-a7afd1875fd1'),
        (46, 'f6d606c9-b324-4efa-814f-15a59047a6a5'),
        (54, 'b140e32f-a96b-462f-8c7b-e7243577b2f4'),
        (89, 'a852bb00-e395-468f-9adc-78b3df9c82f6'),
        (97, '3bee9f2d-4494-4560-b9f8-463bc90695cb'),
        (98, '04571d49-0680-4b84-bdb1-dbebeb22c898'),
        (99, '30aab266-9131-4a07-808b-61c868cb404f'),
        (101, '7533ff77-836c-4bd2-9171-487d9c63863c'),
        (105, '5cf39b3b-41d8-45c1-8ef2-d4678c7a7b85'),
        (106, 'c8e10f09-38a0-4730-9dd3-eb0a510c9e43'),
        (117, '37659ff0-a803-4a4f-97ff-ad59822061ed'),
        (153, '3d371fd4-50e2-4b5e-859f-1086e905c946'),
        (154, 'b4791030-9d64-4f98-85cb-ca106f868c5e'),
        (155, '34821163-e32e-42bf-99df-8f42ba66ef34'),
        (156, '6c6e9731-3d70-4f1b-84c2-9dbf3c1f97c7'),
        (157, '4b6700e5-38bd-4d8d-9281-ef82996b135f'),
        (158, '6ec72f64-2002-481c-b7c9-b132476ba6aa'),
        (160, 'c4ceff45-d851-44b1-921b-bfef93a6cd6a'),
        (164, 'f68ee841-88d1-46f3-a1e2-5dc71d9d5d97'),
        (165, '3c9af040-d919-4afc-b768-45821a5b913c'),
        (166, 'c6cfa4d9-e794-4bb6-8da9-54cb779ea109'),
        (167, 'e32d125f-a3f8-4bc7-b0e6-cb7edf22b7ac'),
        (168, 'c2956880-b82a-42d0-962b-eb736dac1536'),
        (169, '13a02a6d-7d67-4d22-8530-d4d2c8443f66'),
        (170, 'c989caf2-84a5-4c01-b99e-5fc9f8d0ce8e'),
        (171, 'ff873dda-2b79-4fa3-b3ce-535b8adff5e2'),
        (172, '14b8caeb-d5e1-4816-9537-86ef19afada8'),
        (181, 'f8ac4c26-8f4d-4cb3-9be2-7d867a95a877'),
        (183, '9dc9c257-c413-416a-ab9b-06fbadf18d1e'),
        (187, '1b57cdac-693b-410b-8343-68fa194c94ae'),
        (226, '28f22bb8-9f1c-4a46-9a39-20bcb1e5000e'),
        (250, '0d690d1a-9f57-4976-bff1-ec46bf039e75'),
        (252, '6c44bcd6-d4c4-41c7-8939-a576e3aa9482')
)
INSERT INTO catalog.legacy_ship_mappings (
    legacy_ship_id, entry_id, legacy_name, catalog_name, match_method
)
SELECT r.legacy_ship_id, e.id, s.name, e.name, 'REVIEWED_EXTERNAL_ID'
  FROM reviewed r
  JOIN fleet.ships s ON s.id = r.legacy_ship_id
  JOIN catalog.entries e
    ON e.source = 'STAR_CITIZEN_WIKI'
   AND e.external_id = r.selected_external_id
   AND e.active
   AND e.family IN ('SHIP', 'GROUND_VEHICLE')
ON CONFLICT (legacy_ship_id) DO UPDATE SET
    entry_id = EXCLUDED.entry_id,
    legacy_name = EXCLUDED.legacy_name,
    catalog_name = EXCLUDED.catalog_name,
    match_method = EXCLUDED.match_method,
    mapped_at = NOW();

WITH ground_vehicles(legacy_ship_id) AS (
    VALUES
        (76), (77), (185), (186), (221), (222), (223)
), last_run AS (
    SELECT id
      FROM catalog.sync_runs
     WHERE status = 'SUCCEEDED'
     ORDER BY completed_at DESC NULLS LAST, id DESC
     LIMIT 1
)
INSERT INTO catalog.entries (
    source, dataset_key, external_id, family, name, manufacturer,
    description, image_url, image_is_fallback, source_version,
    source_payload, focus, scu, size, crew, flight_ready,
    active, last_seen_run_id
)
SELECT 'LEGACY_FLEET',
       'vehicles',
       'legacy-ship:' || s.id,
       CASE WHEN gv.legacy_ship_id IS NULL THEN 'SHIP' ELSE 'GROUND_VEHICLE' END,
       s.name,
       b.name,
       s.notes,
       COALESCE(NULLIF(s.image_url, ''), '/assets/images/catalog/catalog-fallback.svg'),
       NULLIF(s.image_url, '') IS NULL,
       'legacy-cutover-v1',
       jsonb_build_object('legacyShipId', s.id, 'legacyBrandId', s.brand_id),
       s.focus,
       s.scu,
       s.size,
       s.crew,
       s.flight_ready,
       TRUE,
       r.id
  FROM fleet.ships s
  JOIN fleet.brand b ON b.id = s.brand_id
  LEFT JOIN catalog.legacy_ship_mappings existing
    ON existing.legacy_ship_id = s.id
  LEFT JOIN ground_vehicles gv ON gv.legacy_ship_id = s.id
 CROSS JOIN last_run r
 WHERE existing.legacy_ship_id IS NULL
ON CONFLICT (source, external_id) DO UPDATE SET
    family = EXCLUDED.family,
    name = EXCLUDED.name,
    manufacturer = EXCLUDED.manufacturer,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    image_is_fallback = EXCLUDED.image_is_fallback,
    source_payload = EXCLUDED.source_payload,
    focus = EXCLUDED.focus,
    scu = EXCLUDED.scu,
    size = EXCLUDED.size,
    crew = EXCLUDED.crew,
    flight_ready = EXCLUDED.flight_ready,
    active = TRUE,
    last_seen_at = NOW(),
    last_seen_run_id = EXCLUDED.last_seen_run_id;

INSERT INTO catalog.legacy_ship_mappings (
    legacy_ship_id, entry_id, legacy_name, catalog_name, match_method
)
SELECT s.id, e.id, s.name, e.name, 'LEGACY_ENTRY_CREATED'
  FROM fleet.ships s
  JOIN catalog.entries e
    ON e.source = 'LEGACY_FLEET'
   AND e.external_id = 'legacy-ship:' || s.id
   AND e.active
ON CONFLICT (legacy_ship_id) DO UPDATE SET
    entry_id = EXCLUDED.entry_id,
    legacy_name = EXCLUDED.legacy_name,
    catalog_name = EXCLUDED.catalog_name,
    match_method = EXCLUDED.match_method,
    mapped_at = NOW();

DO $$
DECLARE
    unmapped BIGINT;
    invalid_targets BIGINT;
    negative_references BIGINT;
BEGIN
    SELECT COUNT(*) INTO unmapped
      FROM fleet.ships s
      LEFT JOIN catalog.legacy_ship_mappings m ON m.legacy_ship_id = s.id
     WHERE m.legacy_ship_id IS NULL;

    IF unmapped > 0 THEN
        RAISE EXCEPTION '% vaisseau(x) historique(s) sans correspondance unique. Completer catalog.legacy_ship_mappings puis relancer.', unmapped;
    END IF;

    SELECT COUNT(*) INTO invalid_targets
      FROM catalog.legacy_ship_mappings m
      JOIN catalog.entries e ON e.id = m.entry_id
     WHERE NOT e.active OR e.family NOT IN ('SHIP', 'GROUND_VEHICLE');

    IF invalid_targets > 0 THEN
        RAISE EXCEPTION '% correspondance(s) ciblent une entree inactive ou non vehicule', invalid_targets;
    END IF;

    SELECT (SELECT COUNT(*) FROM fleet.user_ships WHERE ship_id < 0)
         + (SELECT COUNT(*) FROM core.users WHERE favorite_ship_id < 0)
         + (SELECT COUNT(*) FROM mining.mining_sheet_ships WHERE ship_id < 0)
      INTO negative_references;

    IF negative_references > 0 THEN
        RAISE EXCEPTION '% reference(s) ship_id negative(s): impossible de reserver les identifiants temporaires', negative_references;
    END IF;
END
$$;

WITH ranked_legacy AS (
    SELECT m.entry_id,
           s.*,
           ROW_NUMBER() OVER (
               PARTITION BY m.entry_id
               ORDER BY CASE
                   WHEN lower(regexp_replace(trim(s.name), '\s+', ' ', 'g')) =
                        lower(regexp_replace(trim(m.catalog_name), '\s+', ' ', 'g'))
                   THEN 0 ELSE 1 END,
                   s.id
           ) AS preference
      FROM catalog.legacy_ship_mappings m
      JOIN fleet.ships s ON s.id = m.legacy_ship_id
)
UPDATE catalog.entries e
   SET focus = COALESCE(e.focus, s.focus),
       scu = COALESCE(e.scu, s.scu),
       size = COALESCE(e.size, s.size),
       crew = COALESCE(e.crew, s.crew),
       flight_ready = COALESCE(e.flight_ready, s.flight_ready),
       description = COALESCE(e.description, s.notes),
       image_url = CASE WHEN e.image_is_fallback THEN COALESCE(s.image_url, e.image_url) ELSE e.image_url END,
       image_is_fallback = CASE WHEN e.image_is_fallback AND s.image_url IS NOT NULL THEN FALSE ELSE e.image_is_fallback END
  FROM ranked_legacy s
 WHERE e.id = s.entry_id
   AND s.preference = 1;

INSERT INTO catalog.cargo_grids (entry_id, size_x, size_y, size_z, source)
SELECT m.entry_id, g.size_x, g.size_y, g.size_z, 'LEGACY_FLEET'
  FROM fleet.ship_cargo_grids g
  JOIN catalog.legacy_ship_mappings m ON m.legacy_ship_id = g.ship_id
ON CONFLICT (entry_id, size_x, size_y, size_z) DO NOTHING;

WITH last_run AS (
    SELECT id
      FROM catalog.sync_runs
     WHERE status = 'SUCCEEDED'
     ORDER BY completed_at DESC NULLS LAST, id DESC
     LIMIT 1
)
INSERT INTO catalog.offers (
    source, external_id, entry_id, entity_name, offer_type, location_name, price,
    currency, source_payload, active, last_seen_run_id
)
SELECT 'LEGACY_FLEET',
       'ship-sale-point:' || p.id,
       m.entry_id,
       s.name,
       'BUY',
       p.location,
       p.price,
       'aUEC',
       jsonb_build_object('legacyShipId', s.id, 'legacySalePointId', p.id),
       TRUE,
       r.id
  FROM fleet.ship_sale_points p
  JOIN fleet.ships s ON s.id = p.ship_id
  JOIN catalog.legacy_ship_mappings m ON m.legacy_ship_id = s.id
 CROSS JOIN last_run r
ON CONFLICT (source, external_id) DO UPDATE SET
    entry_id = EXCLUDED.entry_id,
    entity_name = EXCLUDED.entity_name,
    location_name = EXCLUDED.location_name,
    price = EXCLUDED.price,
    active = TRUE,
    last_seen_at = NOW(),
    last_seen_run_id = EXCLUDED.last_seen_run_id;

WITH projected AS (
    SELECT us.*,
           m.entry_id,
           ROW_NUMBER() OVER (
               PARTITION BY us.user_id, m.entry_id
               ORDER BY us.created_at, us.id::text
           ) AS preference,
           BOOL_OR(us.in_game_purchase) OVER (PARTITION BY us.user_id, m.entry_id) AS any_in_game_purchase,
           BOOL_OR(us.reward_in_game) OVER (PARTITION BY us.user_id, m.entry_id) AS any_reward_in_game,
           BOOL_OR(us.loaner) OVER (PARTITION BY us.user_id, m.entry_id) AS any_loaner,
           MIN(us.acquired_at) OVER (PARTITION BY us.user_id, m.entry_id) AS first_acquired_at,
           MIN(us.created_at) OVER (PARTITION BY us.user_id, m.entry_id) AS first_created_at
      FROM fleet.user_ships us
      JOIN catalog.legacy_ship_mappings m ON m.legacy_ship_id = us.ship_id
), keepers AS (
    SELECT * FROM projected WHERE preference = 1
)
UPDATE fleet.user_ships us
   SET in_game_purchase = k.any_in_game_purchase,
       reward_in_game = k.any_reward_in_game,
       loaner = k.any_loaner,
       acquired_at = k.first_acquired_at,
       created_at = k.first_created_at
  FROM keepers k
 WHERE us.id = k.id;

WITH projected AS (
    SELECT us.id,
           ROW_NUMBER() OVER (
               PARTITION BY us.user_id, m.entry_id
               ORDER BY us.created_at, us.id::text
           ) AS preference
      FROM fleet.user_ships us
      JOIN catalog.legacy_ship_mappings m ON m.legacy_ship_id = us.ship_id
)
DELETE FROM fleet.user_ships us
 USING projected p
 WHERE us.id = p.id
   AND p.preference > 1;

WITH projected AS (
    SELECT ms.id,
           ROW_NUMBER() OVER (
               PARTITION BY ms.sheet_id, m.entry_id, ms.added_by_user_id
               ORDER BY ms.created_at, ms.id::text
           ) AS preference
      FROM mining.mining_sheet_ships ms
      JOIN catalog.legacy_ship_mappings m ON m.legacy_ship_id = ms.ship_id
)
DELETE FROM mining.mining_sheet_ships ms
 USING projected p
 WHERE ms.id = p.id
   AND p.preference > 1;

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

UPDATE fleet.user_ships us
   SET ship_id = -m.entry_id
  FROM catalog.legacy_ship_mappings m
 WHERE us.ship_id = m.legacy_ship_id;

UPDATE core.users u
   SET favorite_ship_id = -m.entry_id
  FROM catalog.legacy_ship_mappings m
 WHERE u.favorite_ship_id = m.legacy_ship_id;

UPDATE mining.mining_sheet_ships ms
   SET ship_id = -m.entry_id
  FROM catalog.legacy_ship_mappings m
 WHERE ms.ship_id = m.legacy_ship_id;

UPDATE fleet.user_ships SET ship_id = -ship_id WHERE ship_id < 0;
UPDATE core.users SET favorite_ship_id = -favorite_ship_id WHERE favorite_ship_id < 0;
UPDATE mining.mining_sheet_ships SET ship_id = -ship_id WHERE ship_id < 0;

ALTER TABLE fleet.user_ships
    ADD CONSTRAINT fk_user_ships_catalog_entry
        FOREIGN KEY (ship_id) REFERENCES catalog.entries(id) ON DELETE CASCADE;

ALTER TABLE core.users
    ADD CONSTRAINT fk_user_favorite_catalog_entry
        FOREIGN KEY (favorite_ship_id) REFERENCES catalog.entries(id) ON DELETE SET NULL;

ALTER TABLE mining.mining_sheet_ships
    ADD CONSTRAINT fk_mining_sheet_ships_catalog_entry
        FOREIGN KEY (ship_id) REFERENCES catalog.entries(id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM fleet.user_ships us
          LEFT JOIN catalog.entries e ON e.id = us.ship_id
         WHERE e.id IS NULL
    ) OR EXISTS (
        SELECT 1
          FROM core.users u
          LEFT JOIN catalog.entries e ON e.id = u.favorite_ship_id
         WHERE u.favorite_ship_id IS NOT NULL AND e.id IS NULL
    ) OR EXISTS (
        SELECT 1
          FROM mining.mining_sheet_ships ms
          LEFT JOIN catalog.entries e ON e.id = ms.ship_id
         WHERE e.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Verification finale impossible: au moins une reference ne cible pas catalog.entries';
    END IF;
END
$$;

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
