\set ON_ERROR_STOP on

BEGIN;

LOCK TABLE public.flyway_schema_history IN ACCESS EXCLUSIVE MODE;

DO $guard$
DECLARE
    applied_versions integer[];
    history_fingerprint text;
BEGIN
    IF to_regclass('public.flyway_schema_history_pre_v28_consolidation') IS NOT NULL THEN
        RAISE EXCEPTION
            'Refus de continuer : la table de sauvegarde Flyway existe déjà';
    END IF;

    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO applied_versions
    FROM public.flyway_schema_history;

    IF applied_versions <> ARRAY(SELECT generate_series(1, 43)) THEN
        RAISE EXCEPTION
            'Refus de continuer : historique attendu V1-V43, historique observé %',
            applied_versions;
    END IF;

    SELECT md5(string_agg(
        concat_ws(chr(124), version, description, script, checksum, success),
        chr(10) ORDER BY installed_rank
    ))
    INTO history_fingerprint
    FROM public.flyway_schema_history;

    IF history_fingerprint <> 'efdc0d3a1ba42834b260125e6c8dc9d3' THEN
        RAISE EXCEPTION
            'Refus de continuer : empreinte Flyway inattendue %',
            history_fingerprint;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.flyway_schema_history
        WHERE NOT success
    ) THEN
        RAISE EXCEPTION
            'Refus de continuer : au moins une migration Flyway est en échec';
    END IF;

    IF to_regclass('core.refresh_tokens') IS NOT NULL THEN
        RAISE EXCEPTION
            'Refus de continuer : core.refresh_tokens existe déjà';
    END IF;
END
$guard$;

CREATE TABLE public.flyway_schema_history_pre_v28_consolidation
AS TABLE public.flyway_schema_history WITH DATA;

UPDATE public.flyway_schema_history AS history
SET description = consolidated.description,
    script = consolidated.script,
    checksum = consolidated.checksum
FROM (
    VALUES
        ('21', 'extend identity and notifications',
         'V21__extend_identity_and_notifications.sql', 675862912),
        ('22', 'extend fleet catalog',
         'V22__extend_fleet_catalog.sql', 234944642),
        ('23', 'extend goals',
         'V23__extend_goals.sql', 924202482),
        ('24', 'create utility features',
         'V24__create_utility_features.sql', 870944379),
        ('25', 'create star citizen catalog',
         'V25__create_star_citizen_catalog.sql', -1570341380),
        ('26', 'create cig watch',
         'V26__create_cig_watch.sql', -555340901),
        ('27', 'create mining operations',
         'V27__create_mining_operations.sql', -2001576570)
) AS consolidated(version, description, script, checksum)
WHERE history.version = consolidated.version;

DELETE FROM public.flyway_schema_history
WHERE version::integer >= 28;

DO $verify$
DECLARE
    consolidated_versions integer[];
BEGIN
    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO consolidated_versions
    FROM public.flyway_schema_history;

    IF consolidated_versions <> ARRAY(SELECT generate_series(1, 27)) THEN
        RAISE EXCEPTION
            'Consolidation invalide : historique V1-V27 attendu, obtenu %',
            consolidated_versions;
    END IF;

    IF (
        SELECT count(*)
        FROM public.flyway_schema_history
        WHERE version::integer BETWEEN 21 AND 27
          AND script LIKE 'V%__%.sql'
    ) <> 7 THEN
        RAISE EXCEPTION
            'Consolidation invalide : métadonnées V21-V27 incomplètes';
    END IF;
END
$verify$;

COMMIT;
