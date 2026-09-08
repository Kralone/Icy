package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class CatalogMapper {
    public static final String WIKI_SOURCE = "STAR_CITIZEN_WIKI";
    static final int BATCH_SIZE = 250;
    private static final String FALLBACK_IMAGE = "/assets/images/catalog/catalog-fallback.svg";
    private static final String UPSERT_ENTRY_SQL = """
            INSERT INTO catalog.entries (
                source, dataset_key, external_id, family, catalog_group, name, slug, manufacturer,
                description, image_url, image_is_fallback, source_url, source_version,
                source_updated_at, source_payload, focus, scu, size, crew, flight_ready,
                active, last_seen_at, last_seen_run_id
            ) VALUES (
                :source, :datasetKey, :externalId, :family, :catalogGroup, :name, :slug, :manufacturer,
                :description, :imageUrl, :imageIsFallback, :sourceUrl, :sourceVersion,
                :sourceUpdatedAt, CAST(:sourcePayload AS jsonb), :focus, :scu, :size, :crew,
                :flightReady, TRUE, NOW(), :runId
            )
            ON CONFLICT (source, external_id) DO UPDATE SET
                dataset_key = EXCLUDED.dataset_key,
                family = EXCLUDED.family,
                catalog_group = EXCLUDED.catalog_group,
                name = EXCLUDED.name,
                slug = EXCLUDED.slug,
                manufacturer = EXCLUDED.manufacturer,
                description = EXCLUDED.description,
                image_url = EXCLUDED.image_url,
                image_is_fallback = EXCLUDED.image_is_fallback,
                source_url = EXCLUDED.source_url,
                source_version = EXCLUDED.source_version,
                source_updated_at = EXCLUDED.source_updated_at,
                source_payload = EXCLUDED.source_payload,
                focus = EXCLUDED.focus,
                scu = EXCLUDED.scu,
                size = EXCLUDED.size,
                crew = EXCLUDED.crew,
                flight_ready = EXCLUDED.flight_ready,
                active = TRUE,
                last_seen_at = NOW(),
                last_seen_run_id = EXCLUDED.last_seen_run_id
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final CatalogRawStore rawStore;
    private final ObjectMapper objectMapper;
    private final CatalogConflictService conflictService;

    public CatalogMapper(
            NamedParameterJdbcTemplate jdbcTemplate,
            CatalogRawStore rawStore,
            ObjectMapper objectMapper,
            CatalogConflictService conflictService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.rawStore = rawStore;
        this.objectMapper = objectMapper;
        this.conflictService = conflictService;
    }

    @Transactional(noRollbackFor = CatalogReviewRequiredException.class)
    public int mapWikiDataset(String datasetKey, long runId) {
        List<JsonNode> records = rawStore.loadActive(WIKI_SOURCE, datasetKey);
        if (records.isEmpty()) {
            throw new IllegalStateException("Aucune donnee brute disponible pour " + datasetKey);
        }
        Set<String> suppressedExternalIds = "vehicles".equals(datasetKey)
                ? conflictService.prepareVehicleMapping(records, runId)
                : Set.of();

        List<MapSqlParameterSource> batch = new ArrayList<>(BATCH_SIZE);
        int mappedCount = 0;
        for (JsonNode record : records) {
            String externalId = text(record, "uuid");
            String name = text(record, "name");
            if (externalId == null || name == null || isPlaceholder(name)
                    || suppressedExternalIds.contains(externalId)) {
                continue;
            }

            String imageUrl = firstImage(record);
            String family = family(datasetKey, record);
            batch.add(new MapSqlParameterSource()
                    .addValue("source", WIKI_SOURCE)
                    .addValue("datasetKey", datasetKey)
                    .addValue("externalId", externalId)
                    .addValue("family", family)
                    .addValue("catalogGroup", CatalogCanonicalizer.catalogGroup(family, name))
                    .addValue("name", name)
                    .addValue("slug", text(record, "slug"))
                    .addValue("manufacturer", text(record.path("manufacturer"), "name"))
                    .addValue("description", description(datasetKey, record))
                    .addValue("imageUrl", imageUrl == null ? FALLBACK_IMAGE : imageUrl)
                    .addValue("imageIsFallback", imageUrl == null)
                    .addValue("sourceUrl", firstText(record, "web_url", "link"))
                    .addValue("sourceVersion", text(record, "version"))
                    .addValue("sourceUpdatedAt", timestamp(text(record, "updated_at")))
                    .addValue("sourcePayload", json(record))
                    .addValue("focus", vehicleFocus(datasetKey, record))
                    .addValue("scu", vehicleScu(datasetKey, record))
                    .addValue("size", vehicleSize(datasetKey, record))
                    .addValue("crew", vehicleCrew(datasetKey, record))
                    .addValue("flightReady", vehicleFlightReady(datasetKey, record))
                    .addValue("runId", runId));
            if (batch.size() == BATCH_SIZE) {
                mappedCount += flushBatch(batch);
            }
        }
        mappedCount += flushBatch(batch);
        if (mappedCount == 0) {
            throw new IllegalStateException("Aucune entree exploitable pour " + datasetKey);
        }

        jdbcTemplate.update("""
                UPDATE catalog.entries
                SET active = FALSE
                WHERE source = :source
                  AND dataset_key = :datasetKey
                  AND last_seen_run_id <> :runId
                  AND active = TRUE
                """, new MapSqlParameterSource()
                .addValue("source", WIKI_SOURCE)
                .addValue("datasetKey", datasetKey)
                .addValue("runId", runId));
        return mappedCount;
    }

    private int flushBatch(List<MapSqlParameterSource> batch) {
        if (batch.isEmpty()) return 0;
        int count = batch.size();
        jdbcTemplate.batchUpdate(UPSERT_ENTRY_SQL, batch.toArray(MapSqlParameterSource[]::new));
        batch.clear();
        return count;
    }

    String family(String datasetKey, JsonNode record) {
        return switch (datasetKey) {
            case "vehicles" -> vehicleFamily(record);
            case "items" -> itemFamily(record);
            case "locations" -> locationFamily(record);
            default -> throw new IllegalArgumentException("Dataset Wiki non mappable: " + datasetKey);
        };
    }

    private String vehicleFamily(JsonNode node) {
        if (node.path("is_power_suit").asBoolean(false)) {
            return "POWER_SUIT";
        }
        if (node.path("is_spaceship").asBoolean(false)) {
            return "SHIP";
        }
        return "GROUND_VEHICLE";
    }

    private String itemFamily(JsonNode node) {
        String classification = lower(text(node, "classification"));
        String type = lower(text(node, "type"));

        if (classification.startsWith("fps.armor") || type.contains("char_armor")
                || type.equals("armor") || type.equals("suit")) {
            return "ARMOR";
        }
        if (classification.startsWith("fps.weapon") || type.equals("weaponpersonal")
                || type.equals("weaponattachment") || type.equals("grenade")) {
            return "FPS_WEAPON";
        }
        if (classification.startsWith("ship.weapon") || classification.startsWith("ship.missile")
                || classification.startsWith("ship.bomb") || type.matches(".*(missile|bomb|weapongun).*")) {
            return "SHIP_WEAPON";
        }
        if (type.equals("module") || classification.equals("mining.module")) {
            return "MODULE";
        }
        if (classification.startsWith("mining.gadget") || type.equals("toolarm")
                || type.equals("gadget") || type.equals("tractorbeam") || type.equals("towingbeam")) {
            return "TOOL";
        }
        if (classification.startsWith("ship.")) {
            return "SHIP_COMPONENT";
        }
        return "ITEM";
    }

    private String locationFamily(JsonNode node) {
        String type = lower(firstText(node.path("type"), "classification", "name"));
        if (type.contains("jump") && type.contains("point")) return "JUMP_POINT";
        if (type.contains("space station") || type.equals("station")) return "STATION";
        if (type.contains("landing zone") || type.equals("city")) return "CITY";
        if (type.equals("planet")) return "PLANET";
        if (type.equals("moon")) return "MOON";
        if (type.equals("system") || type.equals("star")) return "SYSTEM";
        if (type.contains("outpost")) return "OUTPOST";
        return "LOCATION";
    }

    private String description(String datasetKey, JsonNode node) {
        return "vehicles".equals(datasetKey)
                ? firstLocalizedText(node, "game_description", "description")
                : localizedText(node, "description");
    }

    private String firstLocalizedText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = localizedText(node, field);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    String localizedText(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode value = node.path(field);
        if (value.isTextual()) {
            return blankToNull(value.asText());
        }
        if (value.isObject()) {
            return firstText(value, "fr_FR", "fr", "en_EN", "en");
        }
        return null;
    }

    String vehicleFocus(String datasetKey, JsonNode node) {
        return "vehicles".equals(datasetKey)
                ? firstText(node, "role", "focus", "classification_label", "classification")
                : null;
    }

    Integer vehicleScu(String datasetKey, JsonNode node) {
        if (!"vehicles".equals(datasetKey)) return null;
        JsonNode value = node.path("cargo_capacity");
        if (!value.isNumber()) return null;
        return Math.max(0, (int) Math.floor(value.asDouble()));
    }

    String vehicleSize(String datasetKey, JsonNode node) {
        if (!"vehicles".equals(datasetKey)) return null;
        return firstText(node, "size_label", "size");
    }

    String vehicleCrew(String datasetKey, JsonNode node) {
        if (!"vehicles".equals(datasetKey)) return null;
        Integer minimum = integer(node, "crew_min");
        Integer maximum = integer(node, "crew_max");
        if (minimum != null && maximum != null) {
            return minimum.equals(maximum) ? minimum.toString() : minimum + "-" + maximum;
        }
        Integer crew = integer(node, "crew");
        return crew == null ? null : crew.toString();
    }

    Boolean vehicleFlightReady(String datasetKey, JsonNode node) {
        if (!"vehicles".equals(datasetKey)) return null;
        if (node.hasNonNull("is_flight_ready")) {
            return node.path("is_flight_ready").asBoolean(false);
        }
        String status = lower(firstText(node, "production_status", "production_status_label"));
        return !status.isEmpty() && (status.contains("flight ready") || status.contains("flight-ready"));
    }

    private Integer integer(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isIntegralNumber()) return value.asInt();
        if (value.isTextual()) {
            try {
                return Integer.valueOf(value.asText().trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private String firstImage(JsonNode node) {
        JsonNode images = node.path("images");
        if (!images.isArray()) {
            return null;
        }
        for (JsonNode image : images) {
            String url = firstText(image, "thumbnail_url", "original_url");
            if (url != null) {
                return url;
            }
        }
        return null;
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String text(JsonNode node, String field) {
        if (node == null) return null;
        return blankToNull(node.path(field).asText(""));
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }

    private String lower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private boolean isPlaceholder(String name) {
        String normalized = lower(name);
        return normalized.contains("placeholder") || normalized.contains("uninitialized");
    }

    private OffsetDateTime timestamp(String value) {
        if (value == null) return null;
        try {
            return OffsetDateTime.parse(value);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private String json(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Impossible de serialiser une entree catalogue", exception);
        }
    }
}
