\set ON_ERROR_STOP on

\if :{?cutover_commit}
\else
  \set cutover_commit false
\endif

BEGIN;

LOCK TABLE fleet.ships, fleet.brand, catalog.entries
    IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE reviewed_missing_ships (
    legacy_ship_id BIGINT PRIMARY KEY,
    family VARCHAR(40) NOT NULL
) ON COMMIT DROP;

INSERT INTO reviewed_missing_ships (legacy_ship_id, family)
VALUES
    (23, 'SHIP'), (24, 'SHIP'), (38, 'SHIP'), (48, 'SHIP'),
    (65, 'SHIP'), (66, 'SHIP'), (76, 'GROUND_VEHICLE'),
    (77, 'GROUND_VEHICLE'), (86, 'SHIP'), (95, 'SHIP'),
    (102, 'SHIP'), (103, 'SHIP'), (122, 'SHIP'), (123, 'SHIP'),
    (151, 'SHIP'), (152, 'SHIP'), (161, 'SHIP'), (162, 'SHIP'),
    (163, 'SHIP'), (185, 'GROUND_VEHICLE'), (186, 'GROUND_VEHICLE'),
    (190, 'SHIP'), (200, 'SHIP'), (203, 'SHIP'),
    (213, 'SHIP'), (221, 'GROUND_VEHICLE'),
    (222, 'GROUND_VEHICLE'), (223, 'GROUND_VEHICLE');

DO $$
DECLARE
    missing_legacy_rows BIGINT;
    official_name_conflicts BIGINT;
BEGIN
    SELECT COUNT(*)
      INTO missing_legacy_rows
      FROM reviewed_missing_ships r
      LEFT JOIN fleet.ships s ON s.id = r.legacy_ship_id
     WHERE s.id IS NULL;

    IF missing_legacy_rows > 0 THEN
        RAISE EXCEPTION '% vaisseau(x) valide(s) absent(s) de fleet.ships', missing_legacy_rows;
    END IF;

    SELECT COUNT(*)
      INTO official_name_conflicts
      FROM reviewed_missing_ships r
      JOIN fleet.ships s ON s.id = r.legacy_ship_id
      JOIN catalog.entries e
        ON lower(regexp_replace(trim(e.name), '\s+', ' ', 'g')) =
           lower(regexp_replace(trim(s.name), '\s+', ' ', 'g'))
       AND e.source = 'STAR_CITIZEN_WIKI'
       AND e.active
       AND e.family IN ('SHIP', 'GROUND_VEHICLE');

    IF official_name_conflicts > 0 THEN
        RAISE EXCEPTION '% vaisseau(x) ont maintenant une entree officielle homonyme; nouvelle revue requise', official_name_conflicts;
    END IF;
END
$$;

WITH last_run AS (
    SELECT id
      FROM catalog.sync_runs
     WHERE status = 'SUCCEEDED'
     ORDER BY completed_at DESC NULLS LAST, id DESC
     LIMIT 1
)
INSERT INTO catalog.entries (
    source, dataset_key, external_id, family, name, manufacturer,
    description, image_url, image_is_fallback, source_version,
    source_payload, active, last_seen_run_id
)
SELECT 'LEGACY_FLEET',
       'vehicles',
       'legacy-ship:' || s.id,
       r.family,
       s.name,
       b.name,
       s.notes,
       COALESCE(NULLIF(s.image_url, ''), '/assets/images/catalog/catalog-fallback.svg'),
       NULLIF(s.image_url, '') IS NULL,
       'legacy-cutover-v1',
       jsonb_build_object(
           'legacyShipId', s.id,
           'legacyBrandId', s.brand_id,
           'focus', s.focus,
           'scu', s.scu,
           'size', s.size,
           'crew', s.crew,
           'flightReady', s.flight_ready
       ),
       TRUE,
       run.id
  FROM reviewed_missing_ships r
  JOIN fleet.ships s ON s.id = r.legacy_ship_id
  JOIN fleet.brand b ON b.id = s.brand_id
 CROSS JOIN last_run run
ON CONFLICT (source, external_id) DO UPDATE SET
    family = EXCLUDED.family,
    name = EXCLUDED.name,
    manufacturer = EXCLUDED.manufacturer,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    image_is_fallback = EXCLUDED.image_is_fallback,
    source_version = EXCLUDED.source_version,
    source_payload = EXCLUDED.source_payload,
    active = TRUE,
    last_seen_at = NOW(),
    last_seen_run_id = EXCLUDED.last_seen_run_id;

DO $$
DECLARE
    imported BIGINT;
BEGIN
    SELECT COUNT(*)
      INTO imported
      FROM reviewed_missing_ships r
      JOIN catalog.entries e
        ON e.source = 'LEGACY_FLEET'
       AND e.external_id = 'legacy-ship:' || r.legacy_ship_id
       AND e.active;

    IF imported <> 28 THEN
        RAISE EXCEPTION 'Import incomplet: % entree(s) active(s) sur 28', imported;
    END IF;
END
$$;

SELECT e.id, e.name, e.family, e.manufacturer, e.image_is_fallback
  FROM reviewed_missing_ships r
  JOIN catalog.entries e
    ON e.source = 'LEGACY_FLEET'
   AND e.external_id = 'legacy-ship:' || r.legacy_ship_id
 ORDER BY lower(e.name);

\if :cutover_commit
  \echo 'Import des 28 vaisseaux legacy valide : COMMIT.'
  COMMIT;
\else
  \echo 'Dry-run des 28 vaisseaux legacy termine : ROLLBACK.'
  ROLLBACK;
\endif
