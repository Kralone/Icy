-- The V2 bootstrap account shipped with a password hash known to everyone who
-- can read the repository. Never modify V2: existing Flyway histories depend
-- on its checksum. Disable only the exact untouched seed so a legitimate
-- account that has already changed its credentials is preserved.
DO $iceforge_v29$
DECLARE
    legacy_user_id UUID;
    admin_role_id UUID;
BEGIN
    SELECT id
    INTO legacy_user_id
    FROM core.users
    WHERE username = 'Kralone'
      AND discord_id = '190174996235026433'
      AND password = '$2a$10$7XQjzjP7aY0sIj5s3uJbcOsOL7W2PLRgfCJzfzTPd.eBoVRoZ8U6C';

    IF legacy_user_id IS NULL THEN
        RETURN;
    END IF;

    SELECT id
    INTO admin_role_id
    FROM core.roles
    WHERE name = 'ADMIN';

    IF admin_role_id IS NOT NULL THEN
        DELETE FROM core.user_roles
        WHERE user_id = legacy_user_id
          AND role_id = admin_role_id;
    END IF;

    UPDATE core.users
    SET active = false,
        pwd_reset = true,
        password = '{DISABLED_BY_V29}' || gen_random_uuid()::text
    WHERE id = legacy_user_id;
END
$iceforge_v29$;
