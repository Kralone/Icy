package com.icy.icy_backend.controller.dto.response.admin;

import java.util.List;
import java.util.Map;

public record CatalogPageDTO(
        List<CatalogEntryViewDTO> items,
        int page,
        int pageSize,
        long totalElements,
        int totalPages,
        long activeElements,
        long inactiveElements,
        long fallbackImages,
        Map<String, Long> familyCounts
) {
}
