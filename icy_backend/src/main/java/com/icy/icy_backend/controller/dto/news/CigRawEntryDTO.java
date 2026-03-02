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
        OffsetDateTime fetchedAt
) {
}
