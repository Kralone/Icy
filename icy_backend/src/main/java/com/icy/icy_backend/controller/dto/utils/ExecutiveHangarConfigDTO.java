package com.icy.icy_backend.controller.dto.utils;

import com.icy.icy_backend.db.entity.utils.ExecutiveHangarConfig;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
public class ExecutiveHangarConfigDTO {
    private final LocalDateTime initialOpenTime;
    private final LocalDateTime updatedAt;
    private final UUID updatedByUserId;

    public ExecutiveHangarConfigDTO(ExecutiveHangarConfig config) {
        this.initialOpenTime = config.getInitialOpenTime();
        this.updatedAt = config.getUpdatedAt();
        this.updatedByUserId = config.getUpdatedByUserId();
    }
}
