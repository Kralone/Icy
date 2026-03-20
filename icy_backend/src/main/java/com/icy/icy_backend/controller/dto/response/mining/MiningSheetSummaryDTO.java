package com.icy.icy_backend.controller.dto.response.mining;

import java.util.List;

public record MiningSheetSummaryDTO(
        List<MiningSheetSummaryOreDTO> ores,
        List<MiningSheetSummaryOreDTO> keptOres,
        long longestRemainingSeconds,
        List<MiningSheetUserMaterialDTO> userMaterials,
        long totalEstimatedAuec,
        long totalCostsAuec,
        long netEstimatedAuec,
        List<MiningSheetSettlementDTO> settlements,
        long totalDeclaredSalesAuec,
        List<MiningSheetSettlementDTO> saleSettlements,
        List<MiningSheetSaleTransferDTO> saleTransfers
) {
}
