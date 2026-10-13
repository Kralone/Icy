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
    /** Null : le type du groupe n'est pas modifié (STANDARD à la création). */
    private OperationGroup.Kind kind;
    private Long shipModelId;
    private OperationGroup.PositionMode positionMode;
    /** À la création d'un équipage seulement : preset dont la capacité, le mode et les postes sont copiés. */
    private UUID presetId;
}
