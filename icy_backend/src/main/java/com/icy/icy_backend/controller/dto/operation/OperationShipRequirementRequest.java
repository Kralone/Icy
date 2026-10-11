package com.icy.icy_backend.controller.dto.operation;

import com.icy.icy_backend.db.entity.event.OperationShipRequirement;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class OperationShipRequirementRequest {
    private Long groupId;
    private Long shipModelId;
    private Integer quantity;
    private String notes;
    private OperationShipRequirement.Status status;
}
