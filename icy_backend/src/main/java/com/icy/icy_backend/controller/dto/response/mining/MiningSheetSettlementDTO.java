package com.icy.icy_backend.controller.dto.response.mining;

import java.util.UUID;

public record MiningSheetSettlementDTO(
        UUID userId,
        String username,
        long grossEstimateAuec,
        long paidCostsAuec,
        long sharedCostAuec,
        long compensationAuec,
        long payoutAuec
) {
}
