\set ON_ERROR_STOP on

DO $verify$
DECLARE
    applied_versions integer[];
    safe_admin_count integer;
BEGIN
    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO applied_versions
    FROM public.flyway_schema_history;

    IF applied_versions <> ARRAY(SELECT generate_series(1, 29)) THEN
        RAISE EXCEPTION
            'Flyway history invalid: V1-V29 expected, got %',
            applied_versions;
    END IF;

    IF EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE NOT success) THEN
        RAISE EXCEPTION 'Flyway history invalid: failed migration found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.flyway_schema_history
        WHERE version = '29'
          AND description = 'disable unchanged legacy admin'
          AND script = 'V29__disable_unchanged_legacy_admin.sql'
          AND checksum = -1518944632
    ) THEN
        RAISE EXCEPTION 'Flyway V29 metadata is invalid';
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

    IF EXISTS (
        SELECT 1
        FROM core.users u
        WHERE u.username = 'Kralone'
          AND u.discord_id = '190174996235026433'
          AND u.password LIKE '{DISABLED_BY_V29}%'
          AND (
              u.active
              OR NOT u.pwd_reset
              OR EXISTS (
                  SELECT 1
                  FROM core.user_roles ur
                  JOIN core.roles r ON r.id = ur.role_id
                  WHERE ur.user_id = u.id AND r.name = 'ADMIN'
              )
          )
    ) THEN
        RAISE EXCEPTION 'The V29-disabled account still has unsafe state';
    END IF;

    SELECT count(DISTINCT u.id)
    INTO safe_admin_count
    FROM core.users u
    JOIN core.user_roles ur ON ur.user_id = u.id
    JOIN core.roles r ON r.id = ur.role_id
    WHERE r.name = 'ADMIN' AND u.active = true;

    IF safe_admin_count < 1 THEN
        RAISE EXCEPTION 'No active administrator remains after V29';
    END IF;
END
$verify$;

SELECT
    count(*) AS flyway_rows,
    max(version::integer) AS current_version,
    bool_and(success) AS all_successful
FROM public.flyway_schema_history;
