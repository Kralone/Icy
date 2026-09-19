package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.response.front.OreLocationDTO;
import com.icy.icy_backend.controller.dto.response.front.OreMetricRangeDTO;
import com.icy.icy_backend.controller.dto.response.front.OreMixDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

/** Game-file distribution is not a player scan sample; never infer occurrence or medians. */
@Service
public class CatalogOreDistributionService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public CatalogOreDistributionService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<OreLocationDTO> listLocations() {
        Map<String, Location> locations = new TreeMap<>();
        jdbc.query("""
                SELECT id, image_url, image_is_fallback, source_version,
                       COALESCE(source_updated_at, last_seen_at) AS observed_at, source_payload::text
                FROM catalog.entries
                WHERE dataset_key = 'commodities' AND active = TRUE
                  AND source = 'STAR_CITIZEN_WIKI'
                ORDER BY id
                """, rs -> {
            try {
                JsonNode node = mapper.readTree(rs.getString("source_payload"));
                if (!node.path("is_mineable").asBoolean(false)) return;
                String image = rs.getBoolean("image_is_fallback") ? null : rs.getString("image_url");
                add(locations, node, rs.getLong("id"), image, rs.getString("source_version"),
                        rs.getObject("observed_at", OffsetDateTime.class));
            } catch (java.io.IOException exception) {
                throw new IllegalStateException("Fiche minerai catalogue invalide", exception);
            }
        });
        return locations.values().stream().map(Location::dto).toList();
    }

    static void add(Map<String, Location> target, JsonNode commodity, long id, String image,
                    String version, OffsetDateTime updatedAt) {
        String uuid = commodity.path("uuid").asText();
        String name = commodity.path("name").asText();
        if (uuid.isBlank() || name.isBlank()) throw new IllegalStateException("Minerai sans identité");
        for (JsonNode system : commodity.path("systems_grouped")) {
            for (JsonNode place : system.path("locations")) {
                String code = place.path("name").asText("").trim().toUpperCase(Locale.ROOT)
                        .replaceAll("^([A-Z]+[0-9]?) L([1-5])$", "$1-L$2");
                if (code.isBlank()) continue;
                String placeUuid = place.path("uuid").asText("").trim();
                String locationKey = "wiki:" + (placeUuid.isEmpty()
                        ? system.path("name").asText("").trim() + "|" + code : placeUuid);
                Double min = null;
                Double max = null;
                boolean present = false;
                for (JsonNode resource : place.path("resources")) {
                    for (JsonNode material : resource.path("materials")) {
                        if (!uuid.equals(material.path("uuid").asText())) continue;
                        present = true;
                        Double lo = fraction(material.path("min_percentage"));
                        Double hi = fraction(material.path("max_percentage"));
                        if (lo != null && hi != null && lo > hi) throw new IllegalStateException("Concentrations inversées");
                        if (lo != null) min = min == null ? lo : Math.min(min, lo);
                        if (hi != null) max = max == null ? hi : Math.max(max, hi);
                    }
                }
                if (!present) continue;
                Location location = target.computeIfAbsent(locationKey, key -> new Location(key, code, version, updatedAt));
                location.ores.put(uuid, new OreMixDTO(name, null, min, max, null, image, id));
                if (!Objects.equals(location.version, version)) location.version = null;
                if (updatedAt != null && (location.updatedAt == null || updatedAt.isBefore(location.updatedAt)))
                    location.updatedAt = updatedAt;
            }
        }
    }

    private static Double fraction(JsonNode value) {
        if (value.isMissingNode() || value.isNull()) return null;
        if (!value.isNumber() || !Double.isFinite(value.asDouble()) || value.asDouble() < 0 || value.asDouble() > 100)
            throw new IllegalStateException("Concentration minerai invalide");
        return value.asDouble() / 100;
    }

    static final class Location {
        private final String locationKey;
        private final String code;
        private String version;
        private OffsetDateTime updatedAt;
        private final Map<String, OreMixDTO> ores = new TreeMap<>();
        Location(String locationKey, String code, String version, OffsetDateTime updatedAt) {
            this.locationKey = locationKey;
            this.code = code;
            this.version = version;
            this.updatedAt = updatedAt;
        }
        OreLocationDTO dto() {
            OreMetricRangeDTO unknown = new OreMetricRangeDTO(null, null, null);
            return new OreLocationDTO(null, code, "https://api.star-citizen.wiki/commodities", version,
                    updatedAt, null, null, null, unknown, unknown, unknown, unknown, List.copyOf(ores.values()), locationKey);
        }
    }
}
