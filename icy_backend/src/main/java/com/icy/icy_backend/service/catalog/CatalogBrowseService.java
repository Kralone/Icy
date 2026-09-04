package com.icy.icy_backend.service.catalog;

import com.icy.icy_backend.controller.dto.response.admin.CatalogEntryViewDTO;
import com.icy.icy_backend.controller.dto.response.admin.CatalogOfferViewDTO;
import com.icy.icy_backend.controller.dto.response.admin.CatalogPageDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class CatalogBrowseService {
    private static final Set<String> FAMILIES = Set.of(
            "SHIP", "GROUND_VEHICLE", "POWER_SUIT", "FPS_WEAPON", "SHIP_WEAPON",
            "ARMOR", "SHIP_COMPONENT", "MODULE", "TOOL", "ITEM", "SYSTEM",
            "PLANET", "MOON", "CITY", "STATION", "JUMP_POINT", "OUTPOST", "LOCATION"
    );
    private static final Map<String, String> SORTS = Map.of(
            "name", "LOWER(e.name) ASC, e.id ASC",
            "name-desc", "LOWER(e.name) DESC, e.id DESC",
            "recent", "e.last_seen_at DESC, LOWER(e.name) ASC",
            "family", "e.family ASC, LOWER(e.name) ASC"
    );

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final MessageService messageService;

    public CatalogBrowseService(NamedParameterJdbcTemplate jdbcTemplate, MessageService messageService) {
        this.jdbcTemplate = jdbcTemplate;
        this.messageService = messageService;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<CatalogPageDTO>> browse(
            String query,
            String family,
            String status,
            String image,
            String source,
            String sort,
            int page,
            int pageSize
    ) {
        int safePage = Math.max(0, page);
        int safePageSize = Math.max(12, Math.min(60, pageSize));
        String normalizedFamily = normalizeFamily(family);
        String normalizedStatus = normalizeOption(status, Set.of("ALL", "ACTIVE", "INACTIVE"), "ACTIVE");
        String normalizedImage = normalizeOption(image, Set.of("ALL", "ORIGINAL", "FALLBACK"), "ALL");
        String normalizedSource = blankToNull(source);
        String normalizedQuery = blankToNull(query);

        MapSqlParameterSource parameters = new MapSqlParameterSource();
        List<String> clauses = new ArrayList<>();
        if (normalizedQuery != null) {
            clauses.add("(LOWER(e.name) LIKE :query OR LOWER(COALESCE(e.manufacturer, '')) LIKE :query)");
            parameters.addValue("query", "%" + normalizedQuery.toLowerCase(Locale.ROOT) + "%");
        }
        if (normalizedFamily != null) {
            clauses.add("e.family = :family");
            parameters.addValue("family", normalizedFamily);
        }
        if (!"ALL".equals(normalizedStatus)) {
            clauses.add("e.active = :active");
            parameters.addValue("active", "ACTIVE".equals(normalizedStatus));
        }
        if (!"ALL".equals(normalizedImage)) {
            clauses.add("e.image_is_fallback = :fallbackImage");
            parameters.addValue("fallbackImage", "FALLBACK".equals(normalizedImage));
        }
        if (normalizedSource != null) {
            clauses.add("LOWER(e.source) = :source");
            parameters.addValue("source", normalizedSource.toLowerCase(Locale.ROOT));
        }

        String where = clauses.isEmpty() ? "" : " WHERE " + String.join(" AND ", clauses);
        long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM catalog.entries e" + where,
                parameters,
                Long.class
        );

        parameters.addValue("limit", safePageSize);
        parameters.addValue("offset", safePage * safePageSize);
        String normalizedSort = blankToNull(sort);
        String orderBy = normalizedSort == null
                ? SORTS.get("name")
                : SORTS.getOrDefault(normalizedSort.toLowerCase(Locale.ROOT), SORTS.get("name"));
        List<EntryRow> rows = jdbcTemplate.query("""
                        SELECT e.id, e.external_id, e.family, e.name, e.slug, e.manufacturer,
                               e.description, e.image_url, e.image_is_fallback, e.source,
                               e.source_url, e.source_version, e.active, e.last_seen_at
                        FROM catalog.entries e
                        """ + where + " ORDER BY " + orderBy + " LIMIT :limit OFFSET :offset",
                parameters,
                (resultSet, rowNumber) -> entryRow(resultSet));

        Map<Long, List<CatalogOfferViewDTO>> offersByEntry = loadOffers(rows);
        List<CatalogEntryViewDTO> items = rows.stream()
                .map(row -> row.toDto(offersByEntry.getOrDefault(row.id(), List.of())))
                .toList();

        Summary summary = summary();
        int totalPages = total == 0 ? 0 : (int) Math.ceil((double) total / safePageSize);
        CatalogPageDTO result = new CatalogPageDTO(
                items,
                safePage,
                safePageSize,
                total,
                totalPages,
                summary.active(),
                summary.inactive(),
                summary.fallbackImages(),
                summary.familyCounts()
        );
        return messageService.buildResponse("catalog.entries.list", result, total);
    }

    private Map<Long, List<CatalogOfferViewDTO>> loadOffers(List<EntryRow> rows) {
        if (rows.isEmpty()) return Map.of();
        List<Long> entryIds = rows.stream().map(EntryRow::id).toList();
        Map<Long, List<CatalogOfferViewDTO>> offers = new LinkedHashMap<>();
        List<OfferRow> offerRows = jdbcTemplate.query("""
                        SELECT id, entry_id, offer_type, location_name, price, currency,
                               COALESCE(source_updated_at, last_seen_at) AS updated_at
                        FROM catalog.offers
                        WHERE active = TRUE AND entry_id IN (:entryIds)
                        ORDER BY entry_id, offer_type, price, location_name
                        """,
                new MapSqlParameterSource("entryIds", entryIds),
                (resultSet, rowNumber) -> new OfferRow(
                        resultSet.getLong("entry_id"),
                        new CatalogOfferViewDTO(
                                resultSet.getLong("id"),
                                resultSet.getString("offer_type"),
                                resultSet.getString("location_name"),
                                resultSet.getBigDecimal("price"),
                                resultSet.getString("currency"),
                                resultSet.getObject("updated_at", OffsetDateTime.class)
                        )
                ));
        offerRows.forEach(row -> offers.computeIfAbsent(row.entryId(), ignored -> new ArrayList<>()).add(row.offer()));
        return offers;
    }

    private Summary summary() {
        Map<String, Long> familyCounts = new LinkedHashMap<>();
        List<FamilyCount> counts = jdbcTemplate.query("""
                        SELECT family, COUNT(*) AS count
                        FROM catalog.entries
                        WHERE active = TRUE
                        GROUP BY family
                        ORDER BY family
                        """,
                (resultSet, rowNumber) -> new FamilyCount(
                        resultSet.getString("family"),
                        resultSet.getLong("count")
                ));
        counts.forEach(count -> familyCounts.put(count.family(), count.count()));

        return jdbcTemplate.queryForObject("""
                        SELECT COUNT(*) FILTER (WHERE active) AS active_count,
                               COUNT(*) FILTER (WHERE NOT active) AS inactive_count,
                               COUNT(*) FILTER (WHERE active AND image_is_fallback) AS fallback_count
                        FROM catalog.entries
                        """,
                new MapSqlParameterSource(),
                (resultSet, rowNumber) -> new Summary(
                        resultSet.getLong("active_count"),
                        resultSet.getLong("inactive_count"),
                        resultSet.getLong("fallback_count"),
                        Map.copyOf(familyCounts)
                ));
    }

    private EntryRow entryRow(ResultSet resultSet) throws SQLException {
        return new EntryRow(
                resultSet.getLong("id"),
                resultSet.getString("external_id"),
                resultSet.getString("family"),
                resultSet.getString("name"),
                resultSet.getString("slug"),
                resultSet.getString("manufacturer"),
                resultSet.getString("description"),
                resultSet.getString("image_url"),
                resultSet.getBoolean("image_is_fallback"),
                resultSet.getString("source"),
                resultSet.getString("source_url"),
                resultSet.getString("source_version"),
                resultSet.getBoolean("active"),
                resultSet.getObject("last_seen_at", OffsetDateTime.class)
        );
    }

    private String normalizeFamily(String family) {
        String normalized = normalize(family);
        if (normalized == null || "ALL".equals(normalized)) return null;
        if (!FAMILIES.contains(normalized)) {
            throw new IllegalArgumentException("Famille catalogue inconnue: " + family);
        }
        return normalized;
    }

    private String normalizeOption(String value, Set<String> accepted, String fallback) {
        String normalized = normalize(value);
        return normalized != null && accepted.contains(normalized) ? normalized : fallback;
    }

    private String normalize(String value) {
        String trimmed = blankToNull(value);
        return trimmed == null ? null : trimmed.toUpperCase(Locale.ROOT);
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }

    private record Summary(long active, long inactive, long fallbackImages, Map<String, Long> familyCounts) {
    }

    private record OfferRow(long entryId, CatalogOfferViewDTO offer) {
    }

    private record FamilyCount(String family, long count) {
    }

    private record EntryRow(
            Long id,
            String externalId,
            String family,
            String name,
            String slug,
            String manufacturer,
            String description,
            String imageUrl,
            boolean fallbackImage,
            String source,
            String sourceUrl,
            String sourceVersion,
            boolean active,
            OffsetDateTime updatedAt
    ) {
        private CatalogEntryViewDTO toDto(List<CatalogOfferViewDTO> offers) {
            return new CatalogEntryViewDTO(
                    id, externalId, family, name, slug, manufacturer, description, imageUrl,
                    fallbackImage, source, sourceUrl, sourceVersion, active, updatedAt, offers
            );
        }
    }
}
