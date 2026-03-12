package com.icy.icy_backend.controller.dto.response.mining;

import java.util.UUID;

public record MiningSheetJobOreDTO(
        UUID id,
        String oreName,
        double quantityCscu,
        long quantityScu,
        boolean includeInSale
) {
}
