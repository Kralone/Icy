package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.OperationShipRequirement;
import java.time.LocalDateTime;
import java.util.UUID;

public record OperationShipRequirementResponseDTO(UUID id, UUID operationEventId, Long groupId, Long shipModelId, int quantity, String notes, OperationShipRequirement.Status status, LocalDateTime createdAt, LocalDateTime updatedAt) {
    public OperationShipRequirementResponseDTO(OperationShipRequirement value) {
        this(value.getId(), value.getOperationEventId(), value.getGroupId(), value.getShipModelId(), value.getQuantity(), value.getNotes(), value.getStatus(), value.getCreatedAt(), value.getUpdatedAt());
    }
}
