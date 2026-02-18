package com.icy.icy_backend.controller.dto.utils;

import com.icy.icy_backend.db.entity.utils.ExecutiveHangarConfig;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Getter
public class ExecutiveHangarConfigDTO {
    // ISO with offset so the browser parses consistently (no local-time ambiguity).
    private final String initialOpenTime;
    private final String updatedAt;
    private final UUID updatedByUserId;

    public ExecutiveHangarConfigDTO(ExecutiveHangarConfig config) {
        this.initialOpenTime = toIsoOffset(config.getInitialOpenTime());
        this.updatedAt = toIsoOffset(config.getUpdatedAt());
        this.updatedByUserId = config.getUpdatedByUserId();
    }

    private static String toIsoOffset(OffsetDateTime value) {
        if (value == null) return null;
        return value.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }
}
