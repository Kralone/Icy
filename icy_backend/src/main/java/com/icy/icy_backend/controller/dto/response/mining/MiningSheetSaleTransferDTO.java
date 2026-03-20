package com.icy.icy_backend.controller.dto.response.mining;

import java.util.UUID;

public record MiningSheetSaleTransferDTO(
        UUID fromUserId,
        String fromUsername,
        UUID toUserId,
        String toUsername,
        long amountAuec
) {
}
