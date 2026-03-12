package com.icy.icy_backend.controller.dto.mining;

public record MiningSheetJobOreRequest(
        String oreName,
        Double quantityCscu,
        Boolean includeInSale
) {
}
