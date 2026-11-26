package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.response.front.OreLocationDTO;
import com.icy.icy_backend.controller.dto.response.front.OreMixDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

/**
 * Répartition lue dans les fichiers du jeu via l'API Star Citizen Wiki.
 * La chance d'apparition vient du jeu, ce n'est pas une fréquence relevée : aucune médiane n'est déduite.
 */
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
                OreAccumulator ore = new OreAccumulator(name, image, id);
                for (JsonNode resource : place.path("resources")) {
                    boolean inResource = false;
                    for (JsonNode material : resource.path("materials")) {
                        if (!uuid.equals(material.path("uuid").asText())) continue;
                        inResource = true;
                        Double lo = fraction(material.path("min_percentage"));
                        Double hi = fraction(material.path("max_percentage"));
                        if (lo != null && hi != null && lo > hi) throw new IllegalStateException("Concentrations inversées");
                        ore.min = lower(ore.min, lo);
                        ore.max = higher(ore.max, hi);
                    }
                    if (!inResource) continue;
                    ore.present = true;
                    ore.addMethod(method(resource.path("group_name").asText("")));
                    ore.probability = higher(ore.probability, probability(resource.path("relative_probability_max")));
                    JsonNode clustering = resource.path("clustering");
                    if (clustering.isObject()) {
                        ore.clusterMin = lowerInt(ore.clusterMin, size(clustering.path("min_size")));
                        ore.clusterMax = higherInt(ore.clusterMax, size(clustering.path("max_size")));
                        ore.clusterProbability = higher(ore.clusterProbability, probability(clustering.path("probability")));
                    }
                }
                if (!ore.present) continue;
                // Chance d'apparition de ce minerai sur l'astre, lue dans les fichiers du jeu (pas un relevé de joueurs).
                Double placeProbability = probability(place.path("relative_probability"));
                if (placeProbability != null) ore.probability = placeProbability;
                String systemName = system.path("name").asText("").trim();
                Location location = target.computeIfAbsent(locationKey,
                        key -> new Location(key, code, systemName.isEmpty() ? null : systemName, version, updatedAt));
                location.ores.merge(uuid, ore, OreAccumulator::merge);
                if (!Objects.equals(location.version, version)) location.version = null;
                if (updatedAt != null && (location.updatedAt == null || updatedAt.isBefore(location.updatedAt)))
                    location.updatedAt = updatedAt;
            }
        }
    }

    /** Famille de ressource du jeu vers mode de minage affiché. */
    static String method(String groupName) {
        String group = groupName.toLowerCase(Locale.ROOT);
        if (group.startsWith("spaceship")) return "Vaisseau";
        if (group.startsWith("groundvehicle")) return "Véhicule";
        if (group.startsWith("fps")) return "À pied";
        return null;
    }

    /** Une probabilité hors [0, 1] est ignorée plutôt que de bloquer toute la liste des zones. */
    private static Double probability(JsonNode value) {
        if (!value.isNumber()) return null;
        double number = value.asDouble();
        return Double.isFinite(number) && number >= 0 && number <= 1 ? number : null;
    }

    private static Integer size(JsonNode value) {
        if (!value.isNumber()) return null;
        int number = value.asInt();
        return number > 0 && number < 1000 ? number : null;
    }

    private static Double lower(Double current, Double value) {
        if (value == null) return current;
        if (current == null) return value;
        return Math.min(current, value);
    }

    private static Double higher(Double current, Double value) {
        if (value == null) return current;
        if (current == null) return value;
        return Math.max(current, value);
    }

    private static Integer lowerInt(Integer current, Integer value) {
        if (value == null) return current;
        if (current == null) return value;
        return Math.min(current, value);
    }

    private static Integer higherInt(Integer current, Integer value) {
        if (value == null) return current;
        if (current == null) return value;
        return Math.max(current, value);
    }

    static final class OreAccumulator {
        private final String name;
        private final String image;
        private final long id;
        private boolean present;
        private Double probability;
        private Double min;
        private Double max;
        private Integer clusterMin;
        private Integer clusterMax;
        private Double clusterProbability;
        private final Set<String> methods = new LinkedHashSet<>();

        OreAccumulator(String name, String image, long id) {
            this.name = name;
            this.image = image;
            this.id = id;
        }

        void addMethod(String method) {
            if (method != null) methods.add(method);
        }

        OreAccumulator merge(OreAccumulator other) {
            probability = higher(probability, other.probability);
            min = lower(min, other.min);
            max = higher(max, other.max);
            clusterMin = lowerInt(clusterMin, other.clusterMin);
            clusterMax = higherInt(clusterMax, other.clusterMax);
            clusterProbability = higher(clusterProbability, other.clusterProbability);
            methods.addAll(other.methods);
            return this;
        }

        OreMixDTO dto() {
            return new OreMixDTO(name, probability, min, max, image, id,
                    methods.isEmpty() ? null : String.join(" · ", methods), clusterMin, clusterMax, clusterProbability);
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
        private final String systemName;
        private String version;
        private OffsetDateTime updatedAt;
        private final Map<String, OreAccumulator> ores = new TreeMap<>();
        Location(String locationKey, String code, String systemName, String version, OffsetDateTime updatedAt) {
            this.locationKey = locationKey;
            this.code = code;
            this.systemName = systemName;
            this.version = version;
            this.updatedAt = updatedAt;
        }
        OreLocationDTO dto() {
            return new OreLocationDTO(code, "https://api.star-citizen.wiki/commodities", version,
                    updatedAt, ores.values().stream().map(OreAccumulator::dto).toList(), locationKey, systemName);
        }
    }
}
