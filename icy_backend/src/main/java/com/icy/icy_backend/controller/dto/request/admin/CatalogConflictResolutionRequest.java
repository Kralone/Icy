package com.icy.icy_backend.controller.dto.request.admin;

import java.util.List;

public record CatalogConflictResolutionRequest(List<String> externalIds, String externalId) {
    public List<String> selection() {
        if (externalIds != null && !externalIds.isEmpty()) return externalIds;
        return externalId == null ? null : List.of(externalId);
    }
}
