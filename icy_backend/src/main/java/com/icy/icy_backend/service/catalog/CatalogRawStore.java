package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

@Service
public class CatalogRawStore {
    private static final String UPSERT_SQL = """
            INSERT INTO catalog.raw_records (
                source, dataset_key, external_id, source_version, payload,
                active, last_seen_at, last_seen_run_id
            ) VALUES (
                :source, :datasetKey, :externalId, :sourceVersion, CAST(:payload AS jsonb),
                TRUE, NOW(), :runId
            )
            ON CONFLICT (source, dataset_key, external_id) DO UPDATE SET
                source_version = EXCLUDED.source_version,
                payload = EXCLUDED.payload,
                active = TRUE,
                last_seen_at = NOW(),
                last_seen_run_id = EXCLUDED.last_seen_run_id
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public CatalogRawStore(NamedParameterJdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public int upsert(String source, String datasetKey, List<JsonNode> records, long runId) {
        if (records == null || records.isEmpty()) {
            return 0;
        }

        List<MapSqlParameterSource> batch = new ArrayList<>(records.size());
        for (JsonNode record : records) {
            String externalId = externalId(record);
            if (externalId == null) {
                continue;
            }
            batch.add(new MapSqlParameterSource()
                    .addValue("source", source)
                    .addValue("datasetKey", datasetKey)
                    .addValue("externalId", externalId)
                    .addValue("sourceVersion", text(record, "version"))
                    .addValue("payload", toJson(record))
                    .addValue("runId", runId));
        }
        if (batch.isEmpty()) {
            return 0;
        }
        jdbcTemplate.batchUpdate(UPSERT_SQL, batch.toArray(MapSqlParameterSource[]::new));
        return batch.size();
    }

    public void deactivateMissing(String source, String datasetKey, long runId) {
        jdbcTemplate.update("""
                UPDATE catalog.raw_records
                SET active = FALSE
                WHERE source = :source
                  AND dataset_key = :datasetKey
                  AND last_seen_run_id <> :runId
                  AND active = TRUE
                """, new MapSqlParameterSource()
                .addValue("source", source)
                .addValue("datasetKey", datasetKey)
                .addValue("runId", runId));
    }

    public List<JsonNode> loadActive(String source, String datasetKey) {
        return jdbcTemplate.query("""
                SELECT payload::text
                FROM catalog.raw_records
                WHERE source = :source AND dataset_key = :datasetKey AND active = TRUE
                ORDER BY external_id
                """, new MapSqlParameterSource()
                .addValue("source", source)
                .addValue("datasetKey", datasetKey),
                (resultSet, rowNumber) -> parseJson(resultSet));
    }

    private JsonNode parseJson(ResultSet resultSet) throws SQLException {
        try {
            return objectMapper.readTree(resultSet.getString(1));
        } catch (JsonProcessingException exception) {
            throw new SQLException("Payload catalogue JSON invalide", exception);
        }
    }

    private String externalId(JsonNode node) {
        for (String field : List.of("uuid", "id", "slug", "shipName", "name")) {
            String value = text(node, field);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private String text(JsonNode node, String field) {
        if (node == null) {
            return null;
        }
        String value = node.path(field).asText("").trim();
        return value.isEmpty() ? null : value;
    }

    private String toJson(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Impossible de serialiser un record catalogue", exception);
        }
    }
}
