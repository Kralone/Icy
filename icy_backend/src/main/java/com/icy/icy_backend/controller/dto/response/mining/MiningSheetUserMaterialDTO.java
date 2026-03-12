package com.icy.icy_backend.controller.dto.response.mining;

import java.util.List;
import java.util.UUID;

public record MiningSheetUserMaterialDTO(
        UUID userId,
        String username,
        long totalScu,
        List<MiningSheetUserMaterialOreDTO> ores
) {
}
