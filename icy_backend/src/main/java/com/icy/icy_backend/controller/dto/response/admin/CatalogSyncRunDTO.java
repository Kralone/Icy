package com.icy.icy_backend.controller.dto.response.admin;

import com.icy.icy_backend.db.entity.catalog.CatalogSyncRun;

import java.time.OffsetDateTime;

public record CatalogSyncRunDTO(
        Long id,
        String operation,
        String scope,
        String status,
        int currentStep,
        int totalSteps,
        String message,
        String errorMessage,
        OffsetDateTime startedAt,
        OffsetDateTime completedAt,
        OffsetDateTime createdAt
) {
    public CatalogSyncRunDTO(CatalogSyncRun run) {
        this(
                run.getId(),
                run.getOperation(),
                run.getScope(),
                run.getStatus(),
                run.getCurrentStep(),
                run.getTotalSteps(),
                run.getMessage(),
                run.getErrorMessage(),
                run.getStartedAt(),
                run.getCompletedAt(),
                run.getCreatedAt()
        );
    }
}
