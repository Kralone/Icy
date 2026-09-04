package com.icy.icy_backend.controller.dto.response.admin;

import java.time.OffsetDateTime;
import java.util.List;

public record CatalogEntryViewDTO(
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
        OffsetDateTime updatedAt,
        List<CatalogOfferViewDTO> offers
) {
}
