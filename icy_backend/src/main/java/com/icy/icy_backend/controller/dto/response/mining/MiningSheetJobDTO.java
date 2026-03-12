package com.icy.icy_backend.controller.dto.response.mining;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record MiningSheetJobDTO(
        UUID id,
        String type,
        MiningSheetUserDTO owner,
        String refineryMethod,
        Integer durationMinutes,
        Integer costAuec,
        LocalDateTime publishedAt,
        LocalDateTime finishAt,
        Long remainingSeconds,
        String notes,
        List<MiningSheetJobOreDTO> ores,
        boolean editableByCurrentUser,
        boolean timerEditableByCurrentUser
) {
}
