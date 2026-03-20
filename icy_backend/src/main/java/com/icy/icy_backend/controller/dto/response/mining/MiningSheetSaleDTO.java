package com.icy.icy_backend.controller.dto.response.mining;

import java.time.LocalDateTime;
import java.util.UUID;

public record MiningSheetSaleDTO(
        UUID id,
        MiningSheetUserDTO declaredBy,
        long creditAuec,
        LocalDateTime declaredAt
) {
}
