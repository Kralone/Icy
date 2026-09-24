\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

DO $verify$
DECLARE
    applied_versions integer[];
    safe_admin_count integer;
    expected_fk_count integer;
BEGIN
    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO applied_versions
    FROM public.flyway_schema_history
    WHERE success;

    IF applied_versions IS DISTINCT FROM ARRAY(SELECT generate_series(1, 38)) THEN
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
        WHERE version = '31'
          AND description = 'consolidate catalog cutover'
          AND script = 'V31__consolidate_catalog_cutover.sql'
          AND success
    ) THEN
        RAISE EXCEPTION 'Flyway V31 metadata is invalid';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM core.users
        WHERE username = 'Kralone'
          AND discord_id = '190174996235026433'
          AND password = '$2a$10$7XQjzjP7aY0sIj5s3uJbcOsOL7W2PLRgfCJzfzTPd.eBoVRoZ8U6C'
    ) THEN
        RAISE EXCEPTION 'The exact public V2 credential is still present';
    END IF;

    SELECT count(DISTINCT u.id)
    INTO safe_admin_count
    FROM core.users u
    JOIN core.user_roles ur ON ur.user_id = u.id
    JOIN core.roles r ON r.id = ur.role_id
    WHERE r.name = 'ADMIN' AND u.active = true;

    IF safe_admin_count < 1 THEN
        RAISE EXCEPTION 'No active administrator remains after V31';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM events.events
        WHERE event_type IS NULL OR btrim(event_type) = ''
    ) THEN
        RAISE EXCEPTION 'V30 left an event without a usable event_type';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'events'
          AND table_name = 'events'
          AND column_name = 'event_type'
          AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'events.event_type is missing or still nullable after V30';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'events'
          AND table_name = 'events'
          AND column_name = 'type'
          AND is_nullable <> 'YES'
    ) THEN
        RAISE EXCEPTION 'legacy events.type is still NOT NULL after V30';
    END IF;

    IF to_regclass('catalog.sync_runs') IS NULL
       OR to_regclass('catalog.raw_records') IS NULL
       OR to_regclass('catalog.entries') IS NULL
       OR to_regclass('catalog.offers') IS NULL
       OR to_regclass('catalog.canonical_selections') IS NULL
       OR to_regclass('catalog.sync_conflicts') IS NULL
       OR to_regclass('catalog.sync_conflict_candidates') IS NULL
       OR to_regclass('catalog.sync_conflict_selections') IS NULL
       OR to_regclass('catalog.cargo_grids') IS NULL THEN
        RAISE EXCEPTION 'V31 catalog tables are incomplete';
    END IF;

    IF to_regclass('catalog.uk_catalog_sync_one_active_run') IS NULL
       OR to_regclass('catalog.uk_catalog_raw_source_dataset_external') IS NULL
       OR to_regclass('catalog.uk_catalog_entry_source_external') IS NULL
       OR to_regclass('catalog.uk_catalog_offer_source_external') IS NULL THEN
        RAISE EXCEPTION 'V31 catalog uniqueness guarantees are incomplete';
    END IF;

    IF to_regclass('fleet.ships') IS NOT NULL
       OR to_regclass('fleet.ship_sale_points') IS NOT NULL
       OR to_regclass('fleet.ship_cargo_grids') IS NOT NULL THEN
        RAISE EXCEPTION 'V31 legacy ship storage still exists';
    END IF;

    IF to_regclass('catalog.ship_compat') IS NULL
       OR to_regclass('catalog.ship_sale_point_compat') IS NULL
       OR to_regclass('catalog.ship_cargo_grid_compat') IS NULL THEN
        RAISE EXCEPTION 'V31 catalog compatibility views are incomplete';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM fleet.user_ships user_ship
        LEFT JOIN catalog.entries entry ON entry.id = user_ship.ship_id
        WHERE entry.id IS NULL
    ) OR EXISTS (
        SELECT 1
        FROM core.users app_user
        LEFT JOIN catalog.entries entry ON entry.id = app_user.favorite_ship_id
        WHERE app_user.favorite_ship_id IS NOT NULL
          AND entry.id IS NULL
    ) OR EXISTS (
        SELECT 1
        FROM mining.mining_sheet_ships sheet_ship
        LEFT JOIN catalog.entries entry ON entry.id = sheet_ship.ship_id
        WHERE entry.id IS NULL
    ) THEN
        RAISE EXCEPTION 'V31 catalog ship references are invalid';
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
        RAISE EXCEPTION 'V31 catalog ship foreign keys are incomplete: %/3', expected_fk_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.flyway_schema_history
        WHERE version = '32' AND success
          AND script = 'V32__interface_catalogue_and_publication.sql'
          AND description = 'interface catalogue and publication'
    ) THEN
        RAISE EXCEPTION 'Flyway V32 release metadata is invalid';
    END IF;

    IF EXISTS (
        SELECT 1 FROM (VALUES
            ('news', 'cig_watch_entries', 'translation_status', 'character varying'),
            ('news', 'cig_watch_entries', 'auto_publish', 'boolean'),
            ('news', 'cig_watch_entries', 'processing_attempts', 'integer'),
            ('news', 'cig_watch_entries', 'next_retry_at', 'timestamp with time zone'),
            ('news', 'cig_watch_entries', 'last_error', 'character varying'),
            ('news', 'cig_watch_entries', 'news_id', 'bigint'),
            ('news', 'cig_watch_entries', 'delivery_status', 'character varying'),
            ('news', 'cig_watch_entries', 'delivery_attempts', 'integer'),
            ('news', 'cig_watch_entries', 'delivery_retry_at', 'timestamp with time zone'),
            ('news', 'cig_watch_fetch_state', 'source_id', 'bigint'),
            ('news', 'cig_watch_fetch_state', 'last_fetched_at', 'timestamp with time zone'),
            ('news', 'news', 'image_url', 'text'),
            ('catalog', 'wikelo_equipment_recipes', 'id', 'text'),
            ('catalog', 'wikelo_equipment_recipes', 'payload', 'jsonb'),
            ('catalog', 'wikelo_equipment_recipes', 'active', 'boolean'),
            ('catalog', 'wikelo_equipment_recipes', 'published_at', 'timestamp with time zone'),
            ('catalog', 'wikelo_equipment_recipes', 'last_seen_run_id', 'bigint'),
            ('catalog', 'ship_compat', 'ore_capacity', 'integer'),
            ('catalog', 'entries', 'source_image_url', 'text'),
            ('catalog', 'entries', 'source_image_is_fallback', 'boolean'),
            ('catalog', 'entries', 'image_override_url', 'text'),
            ('catalog', 'offers', 'source_entry_id', 'bigint'),
            ('catalog', 'offers', 'entry_override_id', 'bigint')
        ) AS expected(schema_name, table_name, column_name, data_type)
        WHERE NOT EXISTS (
            SELECT 1 FROM information_schema.columns actual
            WHERE actual.table_schema = expected.schema_name
              AND actual.table_name = expected.table_name
              AND actual.column_name = expected.column_name
              AND actual.data_type = expected.data_type
        )
    ) THEN
        RAISE EXCEPTION 'V32 publication, recipes or catalog columns are incomplete';
    END IF;

    IF to_regclass('news.idx_cig_watch_retry') IS NULL
       OR to_regclass('catalog.catalog_offers_unassociated_idx') IS NULL THEN
        RAISE EXCEPTION 'V32 retry or unassociated-offer index is missing';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid = 'news.cig_watch_entries'::regclass AND contype = 'u'
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
              WHERE attrelid = 'news.cig_watch_entries'::regclass AND attname = 'news_id')])
       OR NOT EXISTS (SELECT 1 FROM pg_constraint
        WHERE conrelid = 'news.cig_watch_entries'::regclass AND contype = 'f'
          AND confrelid = 'news.news'::regclass AND confdeltype = 'n'
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
              WHERE attrelid = 'news.cig_watch_entries'::regclass AND attname = 'news_id')]) THEN
        RAISE EXCEPTION 'V32 news publication uniqueness or foreign key is missing';
    END IF;

    IF (SELECT count(*) FROM pg_constraint
        WHERE conrelid = 'catalog.offers'::regclass AND contype = 'f'
          AND confrelid = 'catalog.entries'::regclass AND confdeltype = 'n'
          AND conkey IN (
            ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'catalog.offers'::regclass AND attname = 'source_entry_id')],
            ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'catalog.offers'::regclass AND attname = 'entry_override_id')]
          )) <> 2 THEN
        RAISE EXCEPTION 'V32 persistent offer correction foreign keys are incomplete';
    END IF;
    IF EXISTS (
        SELECT 1 FROM (VALUES
            ('33', 'V33__resources_catalogue.sql')
        ) expected(version, script)
        WHERE NOT EXISTS (SELECT 1 FROM public.flyway_schema_history actual
            WHERE actual.version=expected.version AND actual.script=expected.script AND actual.success)
    ) THEN RAISE EXCEPTION 'V33 migration metadata incomplete'; END IF;

    IF EXISTS (
        SELECT 1 FROM (VALUES
            ('utils','uex_dataset_cache','game_version','character varying'),
            ('public','ore_locations','game_version','character varying'),
            ('public','ore_locations','source_url','text')
        ) expected(schema_name, table_name, column_name, data_type)
        WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns actual
            WHERE actual.table_schema=expected.schema_name AND actual.table_name=expected.table_name
              AND actual.column_name=expected.column_name AND actual.data_type=expected.data_type
              AND actual.is_nullable='YES')
    ) THEN RAISE EXCEPTION 'Resource provenance columns incomplete'; END IF;

    IF EXISTS (
        SELECT 1 FROM (VALUES
            ('ore_locations','users_count'),('ore_locations','scans_count'),('ore_locations','clusters_count'),
            ('ore_locations','cluster_count_min'),('ore_locations','cluster_count_max'),('ore_locations','cluster_count_med'),
            ('ore_locations','mass_min'),('ore_locations','mass_max'),('ore_locations','mass_med'),
            ('ore_locations','inst_min'),('ore_locations','inst_max'),('ore_locations','inst_med'),
            ('ore_locations','res_min'),('ore_locations','res_max'),('ore_locations','res_med'),
            ('ore_location_ores','probability'),('ore_location_ores','min_pct'),
            ('ore_location_ores','max_pct'),('ore_location_ores','med_pct')
        ) expected(table_name,column_name)
        WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns actual
            WHERE actual.table_schema='public' AND actual.table_name=expected.table_name
              AND actual.column_name=expected.column_name AND actual.is_nullable='YES'
              AND actual.column_default IS NULL)
    ) THEN RAISE EXCEPTION 'Unknown mining values cannot remain NULL'; END IF;

    IF to_regclass('content_guides') IS NULL THEN RAISE EXCEPTION 'V38 guides table is missing'; END IF;\r\n\r\n    IF to_regclass('utils.idx_uex_dataset_cache_game_version') IS NULL THEN
        RAISE EXCEPTION 'UEX game version index missing';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='catalog.entries'::regclass
        AND conname='chk_catalog_entry_family' AND convalidated AND pg_get_constraintdef(oid) LIKE '%COMMODITY%')
       OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='catalog.sync_runs'::regclass
        AND conname='chk_catalog_sync_scope' AND convalidated AND pg_get_constraintdef(oid) LIKE '%COMMODITIES%')
    THEN RAISE EXCEPTION 'Commodity catalog constraints incomplete'; END IF;
END
$verify$;

SELECT 'FLYWAY_V33_PRODUCTION_OK' AS result;

ROLLBACK;

