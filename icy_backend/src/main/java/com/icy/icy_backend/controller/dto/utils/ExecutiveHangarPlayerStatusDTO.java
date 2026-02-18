package com.icy.icy_backend.controller.dto.utils;

import com.icy.icy_backend.db.entity.utils.ExecutiveHangarPlayerStatus;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Getter
public class ExecutiveHangarPlayerStatusDTO {
    private final UUID userId;
    private final Boolean hasExecShip;
    private final String updatedAt;
    private final UUID updatedByUserId;

    public ExecutiveHangarPlayerStatusDTO(ExecutiveHangarPlayerStatus status) {
        this.userId = status.getUserId();
        this.hasExecShip = status.getHasExecShip();
        this.updatedAt = toIsoOffset(status.getUpdatedAt());
        this.updatedByUserId = status.getUpdatedByUserId();
    }

    private static String toIsoOffset(OffsetDateTime value) {
        if (value == null) return null;
        return value.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }
}
