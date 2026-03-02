package com.icy.icy_backend.controller.dto.news;

import com.icy.icy_backend.db.entity.news.CigSourceKind;

import java.time.OffsetDateTime;

public record CigWatchSourceDTO(
        Long id,
        String label,
        String sourceUrl,
        CigSourceKind sourceKind,
        boolean enabled,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
