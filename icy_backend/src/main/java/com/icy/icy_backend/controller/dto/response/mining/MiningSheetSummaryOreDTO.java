package com.icy.icy_backend.controller.dto.response.mining;

public record MiningSheetSummaryOreDTO(
        String oreName,
        double totalCscu,
        long totalScu,
        Integer bestSellAuec,
        String bestSellTerminal,
        Long estimatedAuec
) {
}
