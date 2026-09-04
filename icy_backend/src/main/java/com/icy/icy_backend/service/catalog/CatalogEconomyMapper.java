package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.db.entity.utils.UexDatasetCache;
import com.icy.icy_backend.db.repository.utils.UexDatasetCacheRepository;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

@Service
public class CatalogEconomyMapper {
    private static final String SOURCE = "UEX";
    private static final List<String> REQUIRED_DATASETS = List.of(
            "items_prices", "vehicles_purchases_prices", "vehicles_rentals_prices"
    );
    private static final String UPSERT_SQL = """
            INSERT INTO catalog.offers (
                source, external_id, entry_id, entity_external_id, entity_name,
                offer_type, location_name, price, currency, source_version,
                source_updated_at, source_payload, active, last_seen_at, last_seen_run_id
            ) VALUES (
                :source, :externalId,
                COALESCE(
                    (SELECT id FROM catalog.entries
                     WHERE source = 'STAR_CITIZEN_WIKI' AND external_id = :entityExternalId
                     LIMIT 1),
                    (SELECT id FROM catalog.entries
                     WHERE LOWER(name) = LOWER(:entityName) AND active = TRUE
                     ORDER BY CASE WHEN family IN ('SHIP', 'GROUND_VEHICLE') THEN 0 ELSE 1 END, id
                     LIMIT 1)
                ),
                :entityExternalId, :entityName, :offerType, :locationName, :price,
                'aUEC', :sourceVersion, :sourceUpdatedAt, CAST(:sourcePayload AS jsonb),
                TRUE, NOW(), :runId
            )
            ON CONFLICT (source, external_id) DO UPDATE SET
                entry_id = EXCLUDED.entry_id,
                entity_external_id = EXCLUDED.entity_external_id,
                entity_name = EXCLUDED.entity_name,
                offer_type = EXCLUDED.offer_type,
                location_name = EXCLUDED.location_name,
                price = EXCLUDED.price,
                source_version = EXCLUDED.source_version,
                source_updated_at = EXCLUDED.source_updated_at,
                source_payload = EXCLUDED.source_payload,
                active = TRUE,
                last_seen_at = NOW(),
                last_seen_run_id = EXCLUDED.last_seen_run_id
            """;

    private final UexDatasetCacheRepository cacheRepository;
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public CatalogEconomyMapper(
            UexDatasetCacheRepository cacheRepository,
            NamedParameterJdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper
    ) {
        this.cacheRepository = cacheRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public List<String> requiredDatasets() {
        return REQUIRED_DATASETS;
    }

    @Transactional
    public int map(long runId) {
        List<MapSqlParameterSource> offers = new ArrayList<>();
        addItemOffers(required("items_prices"), offers, runId);
        addVehicleOffers(required("vehicles_purchases_prices"), "BUY", "price_buy", offers, runId);
        addVehicleOffers(required("vehicles_rentals_prices"), "RENT", "price_rent", offers, runId);
        if (offers.isEmpty()) {
            throw new IllegalStateException("Les datasets UEX ne contiennent aucune offre exploitable");
        }

        jdbcTemplate.batchUpdate(UPSERT_SQL, offers.toArray(MapSqlParameterSource[]::new));
        jdbcTemplate.update("""
                UPDATE catalog.offers
                SET active = FALSE
                WHERE source = :source AND last_seen_run_id <> :runId AND active = TRUE
                """, new MapSqlParameterSource().addValue("source", SOURCE).addValue("runId", runId));
        return offers.size();
    }

    private UexDatasetCache required(String key) {
        UexDatasetCache cache = cacheRepository.findById(key)
                .orElseThrow(() -> new IllegalStateException("Dataset UEX absent: " + key));
        if (cache.getPayload() == null || !cache.getPayload().isArray()) {
            throw new IllegalStateException("Dataset UEX invalide: " + key);
        }
        return cache;
    }

    private void addItemOffers(UexDatasetCache cache, List<MapSqlParameterSource> target, long runId) {
        for (JsonNode node : cache.getPayload()) {
            addOffer(cache, node, "BUY", "price_buy", "item_uuid", "item_name", target, runId);
            addOffer(cache, node, "SELL", "price_sell", "item_uuid", "item_name", target, runId);
        }
    }

    private void addVehicleOffers(
            UexDatasetCache cache,
            String offerType,
            String priceField,
            List<MapSqlParameterSource> target,
            long runId
    ) {
        for (JsonNode node : cache.getPayload()) {
            addOffer(cache, node, offerType, priceField, "vehicle_uuid", "vehicle_name", target, runId);
        }
    }

    private void addOffer(
            UexDatasetCache cache,
            JsonNode node,
            String offerType,
            String priceField,
            String uuidField,
            String nameField,
            List<MapSqlParameterSource> target,
            long runId
    ) {
        BigDecimal price = node.path(priceField).decimalValue();
        String name = text(node, nameField);
        String location = text(node, "terminal_name");
        if (price.signum() <= 0 || name == null || location == null) {
            return;
        }

        String rowId = firstText(node, "id", "id_item", "id_vehicle");
        String terminalId = firstText(node, "id_terminal", "terminal_name");
        if (rowId == null || terminalId == null) {
            return;
        }
        String externalId = cache.getDatasetKey() + ":" + rowId + ":" + terminalId + ":" + offerType;
        target.add(new MapSqlParameterSource()
                .addValue("source", SOURCE)
                .addValue("externalId", externalId)
                .addValue("entityExternalId", text(node, uuidField))
                .addValue("entityName", name)
                .addValue("offerType", offerType)
                .addValue("locationName", location)
                .addValue("price", price)
                .addValue("sourceVersion", text(node, "game_version"))
                .addValue("sourceUpdatedAt", unixTimestamp(node.path("date_modified").asLong(0)))
                .addValue("sourcePayload", json(node))
                .addValue("runId", runId));
    }

    private OffsetDateTime unixTimestamp(long timestamp) {
        return timestamp <= 0 ? null : OffsetDateTime.ofInstant(Instant.ofEpochSecond(timestamp), ZoneOffset.UTC);
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (value != null) return value;
        }
        return null;
    }

    private String text(JsonNode node, String field) {
        String value = node.path(field).asText("").trim();
        return value.isEmpty() ? null : value;
    }

    private String json(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Impossible de serialiser une offre UEX", exception);
        }
    }
}
