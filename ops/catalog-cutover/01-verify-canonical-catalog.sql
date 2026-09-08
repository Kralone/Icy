\set ON_ERROR_STOP on

DO $$
DECLARE
    latest_run_status VARCHAR(20);
    active_ship_count BIGINT;
    missing_ship_fields BIGINT;
BEGIN
    SELECT status
      INTO latest_run_status
      FROM catalog.sync_runs
     WHERE operation = 'SCRAPE_ALL'
        OR (operation = 'SCRAPE_AND_MAP' AND (scope IS NULL OR scope = 'VEHICLES'))
     ORDER BY created_at DESC
     LIMIT 1;

    IF latest_run_status IS DISTINCT FROM 'SUCCEEDED' THEN
        RAISE EXCEPTION 'Le dernier scrape global ou VEHICLES doit etre SUCCEEDED (statut actuel: %)',
            COALESCE(latest_run_status, 'ABSENT');
    END IF;

    SELECT COUNT(*)
      INTO active_ship_count
      FROM catalog.entries
     WHERE active
       AND family IN ('SHIP', 'GROUND_VEHICLE');

    IF active_ship_count = 0 THEN
        RAISE EXCEPTION 'Le catalogue ne contient aucun vaisseau ou vehicule actif';
    END IF;

    SELECT COUNT(*)
      INTO missing_ship_fields
      FROM catalog.entries
     WHERE active
       AND family IN ('SHIP', 'GROUND_VEHICLE')
       AND (name IS NULL OR image_url IS NULL OR manufacturer IS NULL);

    IF missing_ship_fields > 0 THEN
        RAISE EXCEPTION '% entree(s) vaisseau sans nom, image ou fabricant', missing_ship_fields;
    END IF;

    RAISE NOTICE 'Catalogue canonique valide: % vaisseaux/vehicules actifs', active_ship_count;
END
$$;

SELECT id, name, manufacturer, focus, scu, size, crew, flight_ready, source_version
  FROM catalog.entries
 WHERE active
   AND family IN ('SHIP', 'GROUND_VEHICLE')
 ORDER BY lower(name);
