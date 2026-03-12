package com.icy.icy_backend.controller.dto.mining;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record MiningSheetUpdateRequest(
        String sheetName,
        LocalDate operationDate,
        String refineryLocation,
        String saleLocation,
        List<UUID> memberIds
) {
}
