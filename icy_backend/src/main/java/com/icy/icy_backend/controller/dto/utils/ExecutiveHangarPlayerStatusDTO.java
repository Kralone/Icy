package com.icy.icy_backend.controller.dto.utils;

import com.icy.icy_backend.db.entity.utils.ExecutiveHangarPlayerStatus;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
public class ExecutiveHangarPlayerStatusDTO {
    private final UUID userId;
    private final Boolean hasExecShip;
    private final LocalDateTime updatedAt;
    private final UUID updatedByUserId;

    public ExecutiveHangarPlayerStatusDTO(ExecutiveHangarPlayerStatus status) {
        this.userId = status.getUserId();
        this.hasExecShip = status.getHasExecShip();
        this.updatedAt = status.getUpdatedAt();
        this.updatedByUserId = status.getUpdatedByUserId();
    }
}
