package com.icy.icy_backend.controller.dto.operation;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import lombok.Data;
import java.util.UUID;
@Data
public class OperationGroupRequest {
    private String name;
    private String description;
    private Integer capacity;
    private Long parentId;
    private OperationGroup.AssignmentMode assignmentMode = OperationGroup.AssignmentMode.INHERITED;
    private int sortOrder;
    private UUID responsibleUserId;
}
