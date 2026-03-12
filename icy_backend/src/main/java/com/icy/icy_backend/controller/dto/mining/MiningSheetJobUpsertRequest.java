package com.icy.icy_backend.controller.dto.mining;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record MiningSheetJobUpsertRequest(
        String type,
        UUID ownerUserId,
        String refineryMethod,
        Integer durationMinutes,
        Integer costAuec,
        LocalDateTime publishedAt,
        String notes,
        List<MiningSheetJobOreRequest> ores
) {
}
