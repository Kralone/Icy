package com.icy.icy_backend.controller.dto.response.admin;

public record CatalogConflictCandidateDTO(
        String externalId,
        String name,
        String slug,
        String imageUrl,
        boolean fallbackImage,
        String description,
        String sourceUrl
) {
}
