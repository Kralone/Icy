\set ON_ERROR_STOP on

BEGIN;

LOCK TABLE public.flyway_schema_history IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.flyway_schema_history_pre_v28_consolidation
    IN ACCESS EXCLUSIVE MODE;

DO $guard$
DECLARE
    current_versions integer[];
    original_versions integer[];
    original_fingerprint text;
BEGIN
    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO current_versions
    FROM public.flyway_schema_history;

    IF current_versions <> ARRAY(SELECT generate_series(1, 28)) THEN
        RAISE EXCEPTION
            'Refus du rollback : historique courant V1-V28 attendu, obtenu %',
            current_versions;
    END IF;

    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO original_versions
    FROM public.flyway_schema_history_pre_v28_consolidation;

    IF original_versions <> ARRAY(SELECT generate_series(1, 43)) THEN
        RAISE EXCEPTION
            'Refus du rollback : sauvegarde V1-V43 attendue, obtenue %',
            original_versions;
    END IF;

    SELECT md5(string_agg(
        concat_ws(chr(124), version, description, script, checksum, success),
        chr(10) ORDER BY installed_rank
    ))
    INTO original_fingerprint
    FROM public.flyway_schema_history_pre_v28_consolidation;

    IF original_fingerprint <> 'efdc0d3a1ba42834b260125e6c8dc9d3' THEN
        RAISE EXCEPTION
            'Refus du rollback : empreinte de sauvegarde inattendue %',
            original_fingerprint;
    END IF;
END
$guard$;

TRUNCATE TABLE public.flyway_schema_history;

INSERT INTO public.flyway_schema_history (
    installed_rank,
    version,
    description,
    type,
    script,
    checksum,
    installed_by,
    installed_on,
    execution_time,
    success
)
SELECT
    installed_rank,
    version,
    description,
    type,
    script,
    checksum,
    installed_by,
    installed_on,
    execution_time,
    success
FROM public.flyway_schema_history_pre_v28_consolidation
ORDER BY installed_rank;

COMMIT;

-- La table additive core.refresh_tokens est volontairement conservée. L'ancien
-- backend l'ignore et aucun jeton n'est détruit. Une nouvelle tentative de
-- consolidation devra être préparée explicitement après analyse.
