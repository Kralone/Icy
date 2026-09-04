package com.icy.icy_backend.controller.dto.response.admin;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CatalogOfferViewDTO(
        Long id,
        String type,
        String location,
        BigDecimal price,
        String currency,
        OffsetDateTime updatedAt
) {
}
