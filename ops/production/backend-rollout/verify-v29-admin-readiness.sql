\set ON_ERROR_STOP on

DO $verify$
DECLARE
    applied_versions integer[];
    safe_admin_count integer;
BEGIN
    SELECT array_agg(version::integer ORDER BY version::integer)
    INTO applied_versions
    FROM public.flyway_schema_history
    WHERE success;

    IF applied_versions <> ARRAY(SELECT generate_series(1, 28)) THEN
        RAISE EXCEPTION
            'V29 preflight refused: successful Flyway history must be exactly V1-V28, got %',
            applied_versions;
    END IF;

    IF EXISTS (SELECT 1 FROM public.flyway_schema_history WHERE NOT success) THEN
        RAISE EXCEPTION 'V29 preflight refused: failed Flyway entry found';
    END IF;

    SELECT count(DISTINCT u.id)
    INTO safe_admin_count
    FROM core.users u
    JOIN core.user_roles ur ON ur.user_id = u.id
    JOIN core.roles r ON r.id = ur.role_id
    WHERE r.name = 'ADMIN'
      AND u.active = true
      AND NOT (
          u.username = 'Kralone'
          AND u.discord_id = '190174996235026433'
          AND u.password = '$2a$10$7XQjzjP7aY0sIj5s3uJbcOsOL7W2PLRgfCJzfzTPd.eBoVRoZ8U6C'
      );

    IF safe_admin_count < 1 THEN
        RAISE EXCEPTION
            'V29 preflight refused: create and verify a non-legacy active administrator first';
    END IF;
END
$verify$;

SELECT 'V29_ADMIN_READINESS_OK' AS result;
