package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.OperationShipRequirement;
import java.time.LocalDateTime;
import java.util.UUID;

/** accepted / proposed : vaisseaux liés à ce besoin ; missing : ce qu'il reste à couvrir par des vaisseaux acceptés. */
public record OperationShipRequirementResponseDTO(UUID id, UUID operationEventId, Long groupId, Long shipModelId, int quantity, String notes, OperationShipRequirement.Status status, LocalDateTime createdAt, LocalDateTime updatedAt,
                                                  String shipModelName, String shipModelImageUrl, long accepted, long proposed, long missing) {
    public OperationShipRequirementResponseDTO(OperationShipRequirement value) {
        this(value.getId(), value.getOperationEventId(), value.getGroupId(), value.getShipModelId(), value.getQuantity(), value.getNotes(), value.getStatus(), value.getCreatedAt(), value.getUpdatedAt(),
                null, null, 0, 0, value.getQuantity());
    }

    public OperationShipRequirementResponseDTO withFleet(String modelName, String modelImageUrl, long acceptedShips, long proposedShips) {
        return new OperationShipRequirementResponseDTO(id, operationEventId, groupId, shipModelId, quantity, notes, status, createdAt, updatedAt,
                modelName, modelImageUrl, acceptedShips, proposedShips, Math.max(0, quantity - acceptedShips));
    }
}
