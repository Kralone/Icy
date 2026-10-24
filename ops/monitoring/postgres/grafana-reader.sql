-- Rôle de lecture des tableaux de bord métier de Grafana.
-- Le tableau « Activité des membres » rattache des actions datées à des pseudos : réservé aux administrateurs.
-- Idempotent : à rejouer après chaque migration qui recrée une table lue ici.
--
--   psql -v ON_ERROR_STOP=1 -v grafana_password="$GRAFANA_DB_PASSWORD" -f grafana-reader.sql
--
-- Seules les colonnes utiles aux statistiques sont lisibles : ni mots de passe, ni identifiants
-- Discord, ni jetons, ni clés de notification, ni textes libres des candidatures.

SELECT format('CREATE ROLE iceforge_grafana LOGIN')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iceforge_grafana')
\gexec

ALTER ROLE iceforge_grafana WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT
    CONNECTION LIMIT 5 PASSWORD :'grafana_password';
ALTER ROLE iceforge_grafana SET default_transaction_read_only = on;
ALTER ROLE iceforge_grafana SET statement_timeout = '15s';

SELECT format('GRANT CONNECT ON DATABASE %I TO iceforge_grafana', current_database())
\gexec

GRANT USAGE ON SCHEMA core, events, fleet, goals, recruitment, scworld, session, mining, news, catalog, collections,
    media, utils, icelink TO iceforge_grafana;
GRANT USAGE ON SCHEMA public TO iceforge_grafana;

-- Membres : identité affichable et activité, sans mot de passe ni Discord.
GRANT SELECT (id, username, created_at, active, status, last_seen_at, pwd_reset) ON core.users TO iceforge_grafana;
-- Jetons de session : seulement qui et quand, jamais les empreintes. Sert à compter les membres connectés par jour.
GRANT SELECT (user_id, created_at) ON core.refresh_tokens TO iceforge_grafana;
GRANT SELECT ON core.user_params TO iceforge_grafana;
GRANT SELECT ON core.roles, core.user_roles TO iceforge_grafana;
GRANT SELECT (user_id, created_at) ON core.notification_subscriptions TO iceforge_grafana;

-- Candidatures : volume et statut seulement.
GRANT SELECT (id, status, preferred_gameplay, created_at) ON recruitment.recruitment TO iceforge_grafana;

-- Événements, opérations, objectifs, événements Star Citizen.
-- event_type est la colonne de référence (V30) ; l'ancienne colonne « type » peut ne plus exister.
GRANT SELECT (id, event_type, title, start_date_time, end_date_time, created_at, finished, activity_type, discord_message_id, creator_id)
    ON events.events TO iceforge_grafana;
GRANT SELECT ON events.event_participation, events.operations, events.operation_groups,
    events.operation_assignments, events.operation_ship_requirements, events.operation_ship_proposals,
    events.operation_assignment_requests TO iceforge_grafana;
GRANT SELECT (id, name, archived, created_at) ON events.operation_crew_presets TO iceforge_grafana;
GRANT SELECT (id, name, target, current, pinned, completed, created_at, parent_id, user_id) ON goals.goals TO iceforge_grafana;
GRANT SELECT ON goals.goal_participations TO iceforge_grafana;
GRANT SELECT (id, created_at) ON goals.goal_templates TO iceforge_grafana;
GRANT SELECT (id, title, start_at, end_at, type_name) ON scworld.sc_world_event TO iceforge_grafana;
GRANT SELECT (id, scwe_id, user_id, status, total, created_at, updated_at) ON scworld.sc_world_event_participation TO iceforge_grafana;

-- Flotte et collections.
GRANT SELECT ON fleet.user_ships, catalog.ship_compat TO iceforge_grafana;
GRANT SELECT (id, user_id, created_at, updated_at) ON collections.user_collection TO iceforge_grafana;

-- Fiches de minage : montants, règlements et virements.
GRANT SELECT ON session.sheets, session.participants, session.expenses, session.sales, session.settlements,
    session.settlement_shares, session.settlement_transfers, mining.refinery_orders,
    mining.refinery_order_lines, mining.sale_lines TO iceforge_grafana;
GRANT SELECT (sheet_id, actor_user_id, action, at) ON session.history TO iceforge_grafana;

-- Contenu et synchronisations.
GRANT SELECT (id, title, type_id, created_at, discord_message_id) ON news.news TO iceforge_grafana;
GRANT SELECT ON news.news_type, news.cig_watch_fetch_state TO iceforge_grafana;
GRANT SELECT (id, source_label, published_at, fetched_at, created_at, translation_status, delivery_status,
    processing_attempts, delivery_attempts) ON news.cig_watch_entries TO iceforge_grafana;
GRANT SELECT (id, source_label, fetched_at) ON news.cig_watch_fetch_errors TO iceforge_grafana;
GRANT SELECT (id, operation, scope, status, message, started_at, completed_at, created_at)
    ON catalog.sync_runs TO iceforge_grafana;
GRANT SELECT (id, run_id, dataset_key, status, created_at, resolved_at) ON catalog.sync_conflicts TO iceforge_grafana;
GRANT SELECT (id, family, active) ON catalog.entries TO iceforge_grafana;
GRANT SELECT (id, status, published, updated_at) ON public.content_guides TO iceforge_grafana;
GRANT SELECT (id, source, offer_type, active, last_seen_at) ON catalog.offers TO iceforge_grafana;
GRANT SELECT (id, active, published_at) ON catalog.wikelo_equipment_recipes TO iceforge_grafana;

-- Données de jeu et outils.
GRANT SELECT (dataset_key, item_count, fetched_at, game_version) ON utils.uex_dataset_cache TO iceforge_grafana;
GRANT SELECT (id, scraped_at, updated_at) ON utils.wikelo_ships TO iceforge_grafana;
GRANT SELECT (user_id, has_exec_ship, updated_at) ON utils.exec_hangar_player_status TO iceforge_grafana;
GRANT SELECT (id, location_code, game_version, users_count, scans_count, updated_at) ON public.ore_locations TO iceforge_grafana;
GRANT SELECT (id, body_type, system_name) ON public.celestial_bodies TO iceforge_grafana;
GRANT SELECT (id, system_name, station_kind) ON public.orbital_stations TO iceforge_grafana;
GRANT SELECT (id) ON icelink.icelink_block TO iceforge_grafana;
GRANT SELECT (id, size, uploaded_at, category, subcategory, uploader_id) ON media.image_metadata TO iceforge_grafana;
