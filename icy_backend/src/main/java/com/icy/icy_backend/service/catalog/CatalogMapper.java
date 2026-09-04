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

@Service
public class CatalogMapper {
    public static final String WIKI_SOURCE = "STAR_CITIZEN_WIKI";
    private static final String FALLBACK_IMAGE = "/assets/images/catalog/catalog-fallback.svg";
    private static final String UPSERT_ENTRY_SQL = """
            INSERT INTO catalog.entries (
                source, dataset_key, external_id, family, name, slug, manufacturer,
                description, image_url, image_is_fallback, source_url, source_version,
                source_updated_at, source_payload, active, last_seen_at, last_seen_run_id
            ) VALUES (
                :source, :datasetKey, :externalId, :family, :name, :slug, :manufacturer,
                :description, :imageUrl, :imageIsFallback, :sourceUrl, :sourceVersion,
                :sourceUpdatedAt, CAST(:sourcePayload AS jsonb), TRUE, NOW(), :runId
            )
            ON CONFLICT (source, external_id) DO UPDATE SET
                dataset_key = EXCLUDED.dataset_key,
                family = EXCLUDED.family,
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
                active = TRUE,
                last_seen_at = NOW(),
                last_seen_run_id = EXCLUDED.last_seen_run_id
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final CatalogRawStore rawStore;
    private final ObjectMapper objectMapper;

    public CatalogMapper(
            NamedParameterJdbcTemplate jdbcTemplate,
            CatalogRawStore rawStore,
            ObjectMapper objectMapper
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.rawStore = rawStore;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public int mapWikiDataset(String datasetKey, long runId) {
        List<JsonNode> records = rawStore.loadActive(WIKI_SOURCE, datasetKey);
        if (records.isEmpty()) {
            throw new IllegalStateException("Aucune donnee brute disponible pour " + datasetKey);
        }

        List<MapSqlParameterSource> batch = new ArrayList<>(records.size());
        for (JsonNode record : records) {
            String externalId = text(record, "uuid");
            String name = text(record, "name");
            if (externalId == null || name == null || isPlaceholder(name)) {
                continue;
            }

            String imageUrl = firstImage(record);
            batch.add(new MapSqlParameterSource()
                    .addValue("source", WIKI_SOURCE)
                    .addValue("datasetKey", datasetKey)
                    .addValue("externalId", externalId)
                    .addValue("family", family(datasetKey, record))
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
                    .addValue("runId", runId));
        }
        if (batch.isEmpty()) {
            throw new IllegalStateException("Aucune entree exploitable pour " + datasetKey);
        }

        jdbcTemplate.batchUpdate(UPSERT_ENTRY_SQL, batch.toArray(MapSqlParameterSource[]::new));
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
        return batch.size();
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
                ? firstText(node, "game_description", "description")
                : text(node, "description");
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
        String value = node.path(field).asText("").trim();
        return value.isEmpty() ? null : value;
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
