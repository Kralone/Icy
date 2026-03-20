package com.icy.icy_backend.controller.dto.response.mining;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record MiningSheetShipDTO(
        UUID id,
        Long shipId,
        String shipName,
        String shipImageUrl,
        String shipBrandName,
        String shipFocus,
        String shipSize,
        Integer shipScu,
        MiningSheetUserDTO addedBy,
        LocalDateTime addedAt,
        List<MiningSheetShipCargoGridDTO> cargoGrids,
        boolean removableByCurrentUser
) {
}
