package com.icy.icy_backend.controller.dto.news;

import java.time.OffsetDateTime;

public record CigRawEntryDTO(
        Long sourceId,
        String sourceLabel,
        String sourceUrl,
        String externalId,
        String title,
        String link,
        String entryType,
        OffsetDateTime publishedAt,
        Long rankHint,
        String rawExcerpt,
        String rawPayload,
        OffsetDateTime fetchedAt,
        Long id,
        String translationStatus,
        String publicationStatus,
        Long newsId,
        String deliveryStatus,
        String lastError,
        OffsetDateTime nextRetryAt
) {
    public CigRawEntryDTO(Long sourceId, String sourceLabel, String sourceUrl, String externalId, String title,
                          String link, String entryType, OffsetDateTime publishedAt, Long rankHint,
                          String rawExcerpt, String rawPayload, OffsetDateTime fetchedAt) {
        this(sourceId, sourceLabel, sourceUrl, externalId, title, link, entryType, publishedAt, rankHint,
                rawExcerpt, rawPayload, fetchedAt, null, "PENDING", "ARCHIVED", null, "DISABLED", null, null);
    }
}
