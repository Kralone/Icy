package com.icy.icy_backend.controller.dto.response.mining;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record MiningSheetDTO(
        UUID id,
        String sheetName,
        LocalDate operationDate,
        String refineryLocation,
        String saleLocation,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        MiningSheetUserDTO createdBy,
        List<MiningSheetUserDTO> members,
        List<MiningSheetJobDTO> jobs,
        List<MiningSheetShipDTO> sheetShips,
        List<MiningSheetSaleDTO> sales,
        MiningSheetSummaryDTO summary,
        boolean editableByCurrentUser,
        boolean adminView
) {
}
