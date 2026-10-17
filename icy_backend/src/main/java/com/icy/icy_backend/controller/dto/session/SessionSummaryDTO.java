package com.icy.icy_backend.controller.dto.session;

import java.time.LocalDate;
import java.util.UUID;

/** Ligne de la liste des fiches. */
public record SessionSummaryDTO(
        UUID id,
        String name,
        LocalDate sessionDate,
        String status,
        String phase,
        SessionSheetDTO.UserRef organizer,
        int participantCount,
        long totalSales,
        boolean mine,
        UUID operationEventId
) {
}
