package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.OperationGroup;
import lombok.Value;
import lombok.AllArgsConstructor;
import java.util.UUID;

@Value
@AllArgsConstructor
public class OperationGroupResponseDTO {
    Long id; Long parentId; String name; String description; Integer capacity; OperationGroup.AssignmentMode assignmentMode; int sortOrder; UUID responsibleUserId;
    public OperationGroupResponseDTO(OperationGroup group) {
        this(group.getId(), group.getParentId(), group.getName(), group.getDescription(), group.getCapacity(), group.getAssignmentMode(), group.getSortOrder(), group.getResponsibleUserId());
    }
}
