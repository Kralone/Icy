package com.icy.icy_backend.service.catalog;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;

/** Public mining projection: only active, explicitly classified catalog entries. */
@Service
public class CatalogMiningService {
    private static final String FLIGHT_READY_SQL = """
            COALESCE(flight_ready,
                CASE WHEN jsonb_typeof(source_payload->'is_flight_ready') = 'boolean'
                     THEN (source_payload->>'is_flight_ready')::boolean END,
                LOWER(COALESCE(source_payload#>>'{production_status,en_EN}',
                    source_payload#>>'{production_status,en}',
                    CASE WHEN jsonb_typeof(source_payload->'production_status') = 'string'
                         THEN source_payload->>'production_status' END,
                    source_payload#>>'{production_status_label,en_EN}',
                    source_payload#>>'{production_status_label,en}',
                    CASE WHEN jsonb_typeof(source_payload->'production_status_label') = 'string'
                         THEN source_payload->>'production_status_label' END))
                IN ('flight-ready', 'flight ready'))
            """;
    private final JdbcTemplate jdbc;
    public CatalogMiningService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list() {
        return jdbc.queryForList("""
            SELECT id, name, manufacturer, description,
                   CASE WHEN image_is_fallback THEN NULL ELSE image_url END AS "imageUrl",
                   source_image_url AS "sourceImageUrl",
                   COALESCE(focus, source_payload->>'role') AS focus, scu, size, crew,
                   %s AS "flightReady",
                   source, source_url AS "sourceUrl", source_version AS "gameVersion",
                   COALESCE(source_updated_at, last_seen_at) AS "updatedAt",
                   CASE
                     WHEN family IN ('SHIP', 'GROUND_VEHICLE') THEN 'ship'
                     WHEN source_payload->>'classification' = 'Mining.Gadget' THEN 'gadget'
                     WHEN source_payload->>'type' = 'WeaponMining'
                       OR source_payload->>'classification' = 'Ship.Mining.Gun' THEN 'mining_laser'
                     WHEN source_payload->>'type' = 'MiningModifier'
                       OR source_payload->>'classification' = 'Mining.Module' THEN 'module'
                     WHEN source_payload->>'type' = 'MiningPod' THEN 'cargo_pod'
                     ELSE NULL
                   END AS kind
            FROM catalog.entries
            WHERE active = TRUE AND (
              (family IN ('SHIP', 'GROUND_VEHICLE')
                 AND %s = TRUE
                 AND LOWER(COALESCE(focus, source_payload->>'role')) ~ '(mining|minage|prospecting)')
              OR source_payload->>'classification' IN ('Mining.Gadget', 'Mining.Module', 'Ship.Mining.Gun')
              OR source_payload->>'type' IN ('WeaponMining', 'MiningModifier', 'MiningPod')
            )
            ORDER BY LOWER(name), id
            """.formatted(FLIGHT_READY_SQL, FLIGHT_READY_SQL));
    }
}
