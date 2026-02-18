package com.icy.icy_backend.controller.dto.utils;

import com.icy.icy_backend.db.entity.utils.ExecutiveHangarConfig;
import lombok.Getter;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
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

    private static String toIsoOffset(LocalDateTime value) {
        if (value == null) return null;
        OffsetDateTime withOffset = value.atZone(ZoneId.systemDefault()).toOffsetDateTime();
        return withOffset.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }
}
