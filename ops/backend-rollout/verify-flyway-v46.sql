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

    IF applied_versions IS DISTINCT FROM ARRAY(SELECT generate_series(1, 46)) THEN
        RAISE EXCEPTION
            'Flyway history invalid: successful V1-V46 expected, got %',
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
          'fk_user_favorite_catalog_entry'
      );

    -- V45 a supprimé mining.mining_sheet_ships et sa clé vers le catalogue : il en reste deux.
    IF expected_fk_count <> 2 THEN
        RAISE EXCEPTION 'V31 catalog ship foreign keys are incomplete: %/2', expected_fk_count;
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

    IF to_regclass('content_guides') IS NULL THEN RAISE EXCEPTION 'V38 guides table is missing'; END IF;

    IF to_regclass('utils.idx_uex_dataset_cache_game_version') IS NULL THEN
        RAISE EXCEPTION 'UEX game version index missing';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='catalog.entries'::regclass
        AND conname='chk_catalog_entry_family' AND convalidated AND pg_get_constraintdef(oid) LIKE '%COMMODITY%')
       OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='catalog.sync_runs'::regclass
        AND conname='chk_catalog_sync_scope' AND convalidated AND pg_get_constraintdef(oid) LIKE '%COMMODITIES%')
    THEN RAISE EXCEPTION 'Commodity catalog constraints incomplete'; END IF;

    -- Scripts et checksums exacts des migrations V31-V46 : une différence signifie un autre historique que celui livré.
    IF EXISTS (
        SELECT 1 FROM (VALUES
            ('31', 'V31__consolidate_catalog_cutover.sql', -300817490),
            ('32', 'V32__interface_catalogue_and_publication.sql', -690618010),
            ('33', 'V33__resources_catalogue.sql', 377288752),
            ('34', 'V34__reserved_catalog_publication.sql', -2050203164),
            ('35', 'V35__reserved_vehicle_capacity.sql', -1663610715),
            ('36', 'V36__reserved_ore_capacity.sql', -1208351898),
            ('37', 'V37__reserved_market_offers.sql', -1360973273),
            ('38', 'V38__create_guides.sql', -573804006),
            ('39', 'V39__wikelo_api_recipes.sql', -1685638562),
            ('40', 'V40__create_operations_foundation.sql', 822361650),
            ('41', 'V41__create_operation_organisation.sql', -1198385798),
            ('42', 'V42__create_operation_fleet.sql', 510170657),
            ('43', 'V43__create_operation_crews.sql', 229862348),
            ('44', 'V44__link_crews_to_presets.sql', -484515197),
            ('45', 'V45__mining_sessions_v3.sql', -554780235),
            ('46', 'V46__create_goal_members.sql', 1218426980)
        ) expected(version, script, checksum)
        WHERE NOT EXISTS (SELECT 1 FROM public.flyway_schema_history actual
            WHERE actual.version = expected.version AND actual.script = expected.script
              AND actual.checksum = expected.checksum AND actual.success)
    ) THEN RAISE EXCEPTION 'Flyway V31-V46 scripts or checksums differ from the delivered migrations'; END IF;

    -- V39 : les offres Wikelo viennent de l'API ; l'ancienne colonne a disparu et chaque offre porte sa mission et sa récompense.
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'utils' AND table_name = 'wikelo_ships' AND column_name = 'source_sheet')
       OR (SELECT count(*) FROM information_schema.columns
           WHERE table_schema = 'utils' AND table_name = 'wikelo_ships' AND is_nullable = 'NO'
             AND column_name IN ('source_version', 'mission_id', 'reward_uuid')) <> 3
       OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'utils.wikelo_ships'::regclass
                      AND conname = 'wikelo_ships_contract_reward_key' AND contype = 'u')
    THEN RAISE EXCEPTION 'V39 Wikelo offer structure is incomplete'; END IF;

    -- V40 : type d'activité des événements, table des opérations et ses deux garde-fous.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'events' AND table_name = 'events' AND column_name = 'activity_type'
                     AND is_nullable = 'NO' AND column_default LIKE '%EVENT%')
       OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'events.events'::regclass
                      AND conname = 'events_activity_type_ck' AND convalidated)
       OR to_regclass('events.operations') IS NULL
       OR (SELECT count(*) FROM pg_trigger
           WHERE NOT tgisinternal AND tgenabled = 'O'
             AND ((tgrelid = 'events.operations'::regclass AND tgname = 'operations_activity_type_guard')
               OR (tgrelid = 'events.events'::regclass AND tgname = 'events_activity_type_guard'))) <> 2
    THEN RAISE EXCEPTION 'V40 operations foundation is incomplete'; END IF;

    -- Aucun événement existant n'a changé de nature, et toute opération repose sur un événement de type OPERATION.
    IF EXISTS (SELECT 1 FROM events.events WHERE activity_type NOT IN ('EVENT', 'OPERATION'))
       OR EXISTS (SELECT 1 FROM events.operations o JOIN events.events e ON e.id = o.event_id WHERE e.activity_type <> 'OPERATION')
       OR EXISTS (SELECT 1 FROM events.events e WHERE e.activity_type = 'OPERATION'
                  AND NOT EXISTS (SELECT 1 FROM events.operations o WHERE o.event_id = e.id))
    THEN RAISE EXCEPTION 'V40 activity types are inconsistent'; END IF;

    -- V41 à V43 : organisation, flotte, équipages.
    IF EXISTS (
        SELECT 1 FROM (VALUES
            ('operation_groups'), ('operation_assignments'), ('operation_assignment_requests'),
            ('operation_ship_requirements'), ('operation_ship_proposals'),
            ('operation_group_positions'), ('operation_crew_presets'), ('operation_crew_preset_positions')
        ) expected(table_name)
        WHERE to_regclass('events.' || expected.table_name) IS NULL
    ) THEN RAISE EXCEPTION 'V41-V43 operation tables are incomplete'; END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'events'
                   AND indexname = 'operation_assignment_request_one_pending'
                   AND indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexdef LIKE '%PENDING%')
       OR EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operation_assignment_request_one_active')
       OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'events.operation_assignments'::regclass
                      AND conname = 'operation_assignment_user_uk' AND contype = 'u')
    THEN RAISE EXCEPTION 'V41 assignment uniqueness guarantees are incomplete'; END IF;

    IF (SELECT count(*) FROM information_schema.columns
        WHERE table_schema = 'events' AND (table_name, column_name) IN (
            ('operation_ship_proposals', 'requirement_id'), ('operation_ship_proposals', 'pilot_user_id'),
            ('operation_groups', 'kind'), ('operation_groups', 'position_mode'),
            ('operation_groups', 'ship_model_id'), ('operation_assignments', 'position_id'))) <> 6
       OR EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
                  WHERE n.nspname = 'events' AND NOT c.convalidated)
    THEN RAISE EXCEPTION 'V42-V43 fleet or crew structure is incomplete'; END IF;

    -- V44 : lien facultatif d'un équipage vers son preset, mis à NULL si le preset disparaît.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'events' AND table_name = 'operation_groups' AND column_name = 'crew_preset_id' AND is_nullable = 'YES')
       OR NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
                      WHERE n.nspname = 'events' AND t.relname = 'operation_groups' AND c.contype = 'f' AND c.confdeltype = 'n'
                        AND c.confrelid = 'events.operation_crew_presets'::regclass)
       OR NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'events' AND indexname = 'operation_groups_crew_preset_idx')
    THEN RAISE EXCEPTION 'V44 crew preset link is incomplete'; END IF;

    -- V45 : fiches de minage V3. Les tables V1 ont disparu, les couches session et minage sont complètes.
    IF to_regclass('mining.mining_sheets') IS NOT NULL OR to_regclass('mining.mining_sheet_members') IS NOT NULL
       OR to_regclass('mining.mining_sheet_jobs') IS NOT NULL OR to_regclass('mining.mining_sheet_job_ores') IS NOT NULL
       OR to_regclass('mining.mining_sheet_ships') IS NOT NULL OR to_regclass('mining.mining_sheet_sales') IS NOT NULL
    THEN RAISE EXCEPTION 'V45 left V1 mining sheet tables in place'; END IF;

    IF EXISTS (
        SELECT 1 FROM (VALUES
            ('session.sheets'), ('session.participants'), ('session.expenses'), ('session.sales'),
            ('session.settlements'), ('session.settlement_shares'), ('session.settlement_transfers'), ('session.history'),
            ('mining.refinery_orders'), ('mining.refinery_order_lines'), ('mining.sale_lines')
        ) expected(table_name)
        WHERE to_regclass(expected.table_name) IS NULL
    ) THEN RAISE EXCEPTION 'V45 mining session tables are incomplete'; END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'session' AND indexname = 'session_settlements_one_current'
                   AND indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexdef LIKE '%cancelled_at IS NULL%')
       OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'session.sheets'::regclass AND contype = 'f'
                      AND confrelid = 'events.operations'::regclass AND confdeltype = 'n')
       OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'session.sheets'::regclass AND contype = 'u')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'events' AND table_name = 'operations' AND column_name = 'mining_session'
                        AND data_type = 'boolean' AND is_nullable = 'NO')
       OR EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
                  WHERE n.nspname IN ('session', 'mining') AND NOT c.convalidated)
    THEN RAISE EXCEPTION 'V45 mining session guarantees are incomplete'; END IF;

    -- V46 : participants déclarés d'un objectif, un seul par joueur, supprimés avec l'objectif ou le joueur.
    IF to_regclass('goals.goal_members') IS NULL
       OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'goals.goal_members'::regclass
                      AND conname = 'uq_goal_members_goal_user' AND contype = 'u')
       OR (SELECT count(*) FROM pg_constraint WHERE conrelid = 'goals.goal_members'::regclass
           AND contype = 'f' AND confdeltype = 'c'
           AND confrelid IN ('goals.goals'::regclass, 'core.users'::regclass)) <> 2
       OR to_regclass('goals.idx_goal_members_user_id') IS NULL
    THEN RAISE EXCEPTION 'V46 goal members structure is incomplete'; END IF;
END
$verify$;

SELECT 'FLYWAY_V46_PRODUCTION_OK' AS result;

ROLLBACK;

