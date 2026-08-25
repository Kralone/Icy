\set ON_ERROR_STOP on

DO $verify$
DECLARE
    applied_versions integer[];
    backup_versions integer[];
    backup_fingerprint text;
BEGIN
    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO applied_versions
    FROM public.flyway_schema_history;

    IF applied_versions <> ARRAY(SELECT generate_series(1, 28)) THEN
        RAISE EXCEPTION
            'Historique Flyway invalide : V1-V28 attendu, obtenu %',
            applied_versions;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.flyway_schema_history
        WHERE NOT success
    ) THEN
        RAISE EXCEPTION 'Historique Flyway invalide : migration en échec';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.flyway_schema_history
        WHERE version = '28'
          AND description = 'create refresh tokens'
          AND script = 'V28__create_refresh_tokens.sql'
          AND checksum = 1815872538
    ) THEN
        RAISE EXCEPTION 'Métadonnées Flyway V28 invalides';
    END IF;

    IF to_regclass('core.refresh_tokens') IS NULL THEN
        RAISE EXCEPTION 'La table core.refresh_tokens est absente';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.flyway_schema_history
        WHERE version::integer >= 29
    ) THEN
        RAISE EXCEPTION 'V29 doit être libre après la consolidation';
    END IF;

    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO backup_versions
    FROM public.flyway_schema_history_pre_v28_consolidation;

    IF backup_versions <> ARRAY(SELECT generate_series(1, 43)) THEN
        RAISE EXCEPTION
            'Sauvegarde Flyway invalide : V1-V43 attendu, obtenu %',
            backup_versions;
    END IF;

    SELECT md5(string_agg(
        concat_ws(chr(124), version, description, script, checksum, success),
        chr(10) ORDER BY installed_rank
    ))
    INTO backup_fingerprint
    FROM public.flyway_schema_history_pre_v28_consolidation;

    IF backup_fingerprint <> 'efdc0d3a1ba42834b260125e6c8dc9d3' THEN
        RAISE EXCEPTION
            'Empreinte de sauvegarde Flyway invalide : %',
            backup_fingerprint;
    END IF;
END
$verify$;

SELECT
    count(*) AS flyway_rows,
    max(version::integer) AS current_version,
    bool_and(success) AS all_successful,
    to_regclass('core.refresh_tokens') AS refresh_tokens_table
FROM public.flyway_schema_history;
