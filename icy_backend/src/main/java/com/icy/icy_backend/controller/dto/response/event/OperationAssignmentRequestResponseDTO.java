package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.OperationAssignmentRequest;
import java.time.LocalDateTime;
import java.util.UUID;

public record OperationAssignmentRequestResponseDTO(UUID id, UUID operationEventId, Long groupId, UUID userId, OperationAssignmentRequest.Status status, LocalDateTime createdAt) {
    public OperationAssignmentRequestResponseDTO(OperationAssignmentRequest request) {
        this(request.getId(), request.getOperationEventId(), request.getGroupId(), request.getUserId(), request.getStatus(), request.getCreatedAt());
    }
}
