package com.icy.icy_backend.controller.dto.response.mining;

public record MiningSheetUserMaterialOreDTO(
        String oreName,
        double totalCscu,
        long totalScu
) {
}
