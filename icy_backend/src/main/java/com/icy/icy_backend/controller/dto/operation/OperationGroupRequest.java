package com.icy.icy_backend.controller.dto.operation;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
@Data
public class OperationGroupRequest {
    @NotBlank @Size(max=120) private String name;
    @Size(max=5000) private String description;
    @Min(0) @Max(10000) private Integer capacity;
    private Long parentId;
    private OperationGroup.AssignmentMode assignmentMode = OperationGroup.AssignmentMode.INHERITED;
    private int sortOrder;
}
