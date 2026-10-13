\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

DO $verify$
BEGIN
    -- Scripts et checksums exacts des migrations V31-V38 : une différence signifie un autre historique que celui livré.
    IF EXISTS (
        SELECT 1 FROM (VALUES
            ('31', 'V31__consolidate_catalog_cutover.sql', -300817490),
            ('32', 'V32__interface_catalogue_and_publication.sql', -690618010),
            ('33', 'V33__resources_catalogue.sql', 377288752),
            ('34', 'V34__reserved_catalog_publication.sql', -2050203164),
            ('35', 'V35__reserved_vehicle_capacity.sql', -1663610715),
            ('36', 'V36__reserved_ore_capacity.sql', -1208351898),
            ('37', 'V37__reserved_market_offers.sql', -1360973273),
            ('38', 'V38__create_guides.sql', -573804006)
        ) expected(version, script, checksum)
        WHERE NOT EXISTS (SELECT 1 FROM public.flyway_schema_history actual
            WHERE actual.version = expected.version AND actual.script = expected.script
              AND actual.checksum = expected.checksum AND actual.success)
    ) THEN RAISE EXCEPTION 'Flyway V31-V38 scripts or checksums differ from the delivered migrations'; END IF;
END
$verify$;

SELECT 'FLYWAY_V38_CHECKSUMS_OK' AS result;

ROLLBACK;
