package com.icy.icy_backend.controller.dto.response.admin;

import java.util.List;

public record CatalogConflictDTO(
        Long id,
        Long runId,
        String family,
        String name,
        String manufacturer,
        List<CatalogConflictCandidateDTO> candidates
) {
}
