package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.response.admin.CatalogConflictCandidateDTO;
import com.icy.icy_backend.controller.dto.response.admin.CatalogConflictDTO;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class CatalogConflictService {
    private static final String SOURCE = CatalogMapper.WIKI_SOURCE;
    private static final String DATASET = "vehicles";
    private static final String FALLBACK_IMAGE = "/assets/images/catalog/catalog-fallback.svg";

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public CatalogConflictService(NamedParameterJdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Transactional(noRollbackFor = CatalogReviewRequiredException.class)
    public Set<String> prepareVehicleMapping(List<JsonNode> records, long runId) {
        Map<String, List<VehicleCandidate>> groups = new LinkedHashMap<>();
        for (JsonNode record : records) {
            VehicleCandidate candidate = candidate(record);
            if (candidate == null) continue;
            groups.computeIfAbsent(candidate.canonicalKey(), ignored -> new ArrayList<>()).add(candidate);
        }

        Map<String, Selection> selections = loadSelections();
        Set<String> suppressed = new LinkedHashSet<>();
        int pending = 0;
        for (List<VehicleCandidate> candidates : groups.values()) {
            if (candidates.size() < 2) continue;
            String canonicalKey = candidates.getFirst().canonicalKey();
            String fingerprint = fingerprint(candidates);
            Selection selection = selections.get(canonicalKey);
            boolean selectionStillValid = selection != null
                    && selection.fingerprint().equals(fingerprint)
                    && candidates.stream().anyMatch(candidate -> candidate.externalId().equals(selection.externalId()));
            if (!selectionStillValid) {
                saveConflict(runId, candidates, fingerprint);
                pending++;
                continue;
            }
            candidates.stream()
                    .map(VehicleCandidate::externalId)
                    .filter(externalId -> !externalId.equals(selection.externalId()))
                    .forEach(suppressed::add);
        }
        if (pending > 0) {
            throw new CatalogReviewRequiredException(pending);
        }
        return Set.copyOf(suppressed);
    }

    @Transactional(readOnly = true)
    public List<CatalogConflictDTO> pendingForRun(long runId) {
        List<ConflictRow> conflicts = jdbcTemplate.query("""
                        SELECT id, run_id, family, name, manufacturer
                        FROM catalog.sync_conflicts
                        WHERE run_id = :runId AND status = 'PENDING'
                        ORDER BY LOWER(name), id
                        """,
                new MapSqlParameterSource("runId", runId),
                (resultSet, rowNumber) -> new ConflictRow(
                        resultSet.getLong("id"), resultSet.getLong("run_id"),
                        resultSet.getString("family"), resultSet.getString("name"),
                        resultSet.getString("manufacturer")
                ));
        if (conflicts.isEmpty()) return List.of();

        List<Long> ids = conflicts.stream().map(ConflictRow::id).toList();
        Map<Long, List<CatalogConflictCandidateDTO>> candidates = new LinkedHashMap<>();
        jdbcTemplate.query("""
                        SELECT conflict_id, external_id, source_payload->>'name' AS candidate_name,
                               slug, image_url, image_is_fallback,
                               description, source_url
                        FROM catalog.sync_conflict_candidates
                        WHERE conflict_id IN (:ids)
                        ORDER BY conflict_id, image_is_fallback, slug, external_id
                        """,
                new MapSqlParameterSource("ids", ids),
                resultSet -> {
                    long conflictId = resultSet.getLong("conflict_id");
                    candidates.computeIfAbsent(conflictId, ignored -> new ArrayList<>()).add(
                            new CatalogConflictCandidateDTO(
                                    resultSet.getString("external_id"), resultSet.getString("candidate_name"),
                                    resultSet.getString("slug"),
                                    resultSet.getString("image_url"), resultSet.getBoolean("image_is_fallback"),
                                    resultSet.getString("description"), resultSet.getString("source_url")
                            ));
                });
        return conflicts.stream()
                .map(conflict -> new CatalogConflictDTO(
                        conflict.id(), conflict.runId(), conflict.family(), conflict.name(), conflict.manufacturer(),
                        List.copyOf(candidates.getOrDefault(conflict.id(), List.of()))
                ))
                .toList();
    }

    @Transactional
    public Resolution resolve(long conflictId, String externalId) {
        if (externalId == null || externalId.isBlank()) {
            throw new IllegalArgumentException("La variante a conserver est requise");
        }
        ConflictSelection conflict = jdbcTemplate.queryForObject("""
                        SELECT run_id, source, dataset_key, canonical_key, candidate_fingerprint, status
                        FROM catalog.sync_conflicts
                        WHERE id = :id
                        FOR UPDATE
                        """,
                new MapSqlParameterSource("id", conflictId),
                (resultSet, rowNumber) -> new ConflictSelection(
                        resultSet.getLong("run_id"), resultSet.getString("source"),
                        resultSet.getString("dataset_key"), resultSet.getString("canonical_key"),
                        resultSet.getString("candidate_fingerprint"), resultSet.getString("status")
                ));
        if (conflict == null) throw new IllegalArgumentException("Conflit catalogue introuvable");
        if (!"PENDING".equals(conflict.status())) {
            throw new IllegalStateException("Ce conflit catalogue est deja resolu");
        }
        Boolean candidateExists = jdbcTemplate.queryForObject("""
                        SELECT EXISTS (
                            SELECT 1 FROM catalog.sync_conflict_candidates
                            WHERE conflict_id = :conflictId AND external_id = :externalId
                        )
                        """,
                new MapSqlParameterSource()
                        .addValue("conflictId", conflictId)
                        .addValue("externalId", externalId.trim()),
                Boolean.class);
        if (!Boolean.TRUE.equals(candidateExists)) {
            throw new IllegalArgumentException("Cette variante ne fait pas partie du conflit");
        }

        jdbcTemplate.update("""
                        INSERT INTO catalog.canonical_selections (
                            source, dataset_key, canonical_key, selected_external_id,
                            candidate_fingerprint, selected_at
                        ) VALUES (
                            :source, :datasetKey, :canonicalKey, :externalId, :fingerprint, NOW()
                        )
                        ON CONFLICT (source, dataset_key, canonical_key) DO UPDATE SET
                            selected_external_id = EXCLUDED.selected_external_id,
                            candidate_fingerprint = EXCLUDED.candidate_fingerprint,
                            selected_at = NOW()
                        """,
                new MapSqlParameterSource()
                        .addValue("source", conflict.source())
                        .addValue("datasetKey", conflict.datasetKey())
                        .addValue("canonicalKey", conflict.canonicalKey())
                        .addValue("externalId", externalId.trim())
                        .addValue("fingerprint", conflict.fingerprint()));
        jdbcTemplate.update("""
                        UPDATE catalog.sync_conflicts
                        SET status = 'RESOLVED', selected_external_id = :externalId, resolved_at = NOW()
                        WHERE id = :id
                        """,
                new MapSqlParameterSource()
                        .addValue("id", conflictId)
                        .addValue("externalId", externalId.trim()));
        Integer remaining = jdbcTemplate.queryForObject("""
                        SELECT COUNT(*) FROM catalog.sync_conflicts
                        WHERE run_id = :runId AND status = 'PENDING'
                        """,
                new MapSqlParameterSource("runId", conflict.runId()), Integer.class);
        return new Resolution(conflict.runId(), remaining == null ? 0 : remaining);
    }

    private Map<String, Selection> loadSelections() {
        Map<String, Selection> selections = new LinkedHashMap<>();
        jdbcTemplate.query("""
                        SELECT canonical_key, selected_external_id, candidate_fingerprint
                        FROM catalog.canonical_selections
                        WHERE source = :source AND dataset_key = :datasetKey
                        """,
                new MapSqlParameterSource().addValue("source", SOURCE).addValue("datasetKey", DATASET),
                resultSet -> {
                    selections.put(
                            resultSet.getString("canonical_key"),
                            new Selection(
                                    resultSet.getString("selected_external_id"),
                                    resultSet.getString("candidate_fingerprint")
                            )
                    );
                });
        return selections;
    }

    private void saveConflict(long runId, List<VehicleCandidate> candidates, String fingerprint) {
        VehicleCandidate display = candidates.stream()
                .filter(candidate -> !candidate.fallbackImage())
                .findFirst()
                .orElse(candidates.getFirst());
        Long conflictId = jdbcTemplate.queryForObject("""
                        INSERT INTO catalog.sync_conflicts (
                            run_id, source, dataset_key, canonical_key, family, name,
                            manufacturer, candidate_fingerprint, status
                        ) VALUES (
                            :runId, :source, :datasetKey, :canonicalKey, :family, :name,
                            :manufacturer, :fingerprint, 'PENDING'
                        )
                        ON CONFLICT (run_id, source, dataset_key, canonical_key) DO UPDATE SET
                            family = EXCLUDED.family,
                            name = EXCLUDED.name,
                            manufacturer = EXCLUDED.manufacturer,
                            candidate_fingerprint = EXCLUDED.candidate_fingerprint,
                            status = 'PENDING',
                            selected_external_id = NULL,
                            resolved_at = NULL
                        RETURNING id
                        """,
                new MapSqlParameterSource()
                        .addValue("runId", runId).addValue("source", SOURCE).addValue("datasetKey", DATASET)
                        .addValue("canonicalKey", display.canonicalKey()).addValue("family", display.family())
                        .addValue("name", candidates.stream()
                                .map(VehicleCandidate::name)
                                .min((left, right) -> Integer.compare(left.length(), right.length()))
                                .orElse(display.name()))
                        .addValue("manufacturer", display.manufacturer()).addValue("fingerprint", fingerprint),
                Long.class);
        jdbcTemplate.update("DELETE FROM catalog.sync_conflict_candidates WHERE conflict_id = :id",
                new MapSqlParameterSource("id", conflictId));
        MapSqlParameterSource[] batch = candidates.stream()
                .map(candidate -> new MapSqlParameterSource()
                        .addValue("conflictId", conflictId).addValue("externalId", candidate.externalId())
                        .addValue("slug", candidate.slug()).addValue("imageUrl", candidate.imageUrl())
                        .addValue("fallback", candidate.fallbackImage()).addValue("description", candidate.description())
                        .addValue("sourceUrl", candidate.sourceUrl()).addValue("payload", json(candidate.payload())))
                .toArray(MapSqlParameterSource[]::new);
        jdbcTemplate.batchUpdate("""
                INSERT INTO catalog.sync_conflict_candidates (
                    conflict_id, external_id, slug, image_url, image_is_fallback,
                    description, source_url, source_payload
                ) VALUES (
                    :conflictId, :externalId, :slug, :imageUrl, :fallback,
                    :description, :sourceUrl, CAST(:payload AS jsonb)
                )
                """, batch);
    }

    private VehicleCandidate candidate(JsonNode record) {
        String externalId = text(record, "uuid");
        String name = text(record, "name");
        if (externalId == null || name == null || isPlaceholder(name)) return null;
        String family = record.path("is_power_suit").asBoolean(false)
                ? "POWER_SUIT"
                : record.path("is_spaceship").asBoolean(false) ? "SHIP" : "GROUND_VEHICLE";
        String manufacturer = text(record.path("manufacturer"), "name");
        String imageUrl = firstImage(record);
        return new VehicleCandidate(
                CatalogCanonicalizer.vehicleKey(family, manufacturer, name), family, name, manufacturer,
                externalId, text(record, "slug"), imageUrl == null ? FALLBACK_IMAGE : imageUrl,
                imageUrl == null, localizedText(record, "game_description", "description"),
                firstText(record, "web_url", "link"), record
        );
    }

    private String fingerprint(List<VehicleCandidate> candidates) {
        String ids = candidates.stream().map(VehicleCandidate::externalId).sorted().reduce((a, b) -> a + "\n" + b).orElse("");
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(ids.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 indisponible", exception);
        }
    }

    private String localizedText(JsonNode node, String... fields) {
        for (String field : fields) {
            JsonNode value = node.path(field);
            if (value.isTextual() && !value.asText().isBlank()) return value.asText().trim();
            if (value.isObject()) {
                String localized = firstText(value, "fr_FR", "fr", "en_EN", "en");
                if (localized != null) return localized;
            }
        }
        return null;
    }

    private String firstImage(JsonNode node) {
        if (!node.path("images").isArray()) return null;
        for (JsonNode image : node.path("images")) {
            String url = firstText(image, "thumbnail_url", "original_url");
            if (url != null) return url;
        }
        return null;
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (value != null) return value;
        }
        return null;
    }

    private String text(JsonNode node, String field) {
        if (node == null) return null;
        String value = node.path(field).asText("").trim();
        return value.isEmpty() ? null : value;
    }

    private boolean isPlaceholder(String name) {
        String normalized = name.toLowerCase(Locale.ROOT);
        return normalized.contains("placeholder") || normalized.contains("uninitialized");
    }

    private String json(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Impossible de serialiser une variante catalogue", exception);
        }
    }

    public record Resolution(long runId, int remainingConflicts) {
    }

    private record Selection(String externalId, String fingerprint) {
    }

    private record ConflictRow(long id, long runId, String family, String name, String manufacturer) {
    }

    private record ConflictSelection(
            long runId, String source, String datasetKey, String canonicalKey, String fingerprint, String status
    ) {
    }

    private record VehicleCandidate(
            String canonicalKey, String family, String name, String manufacturer, String externalId,
            String slug, String imageUrl, boolean fallbackImage, String description, String sourceUrl, JsonNode payload
    ) {
    }
}
