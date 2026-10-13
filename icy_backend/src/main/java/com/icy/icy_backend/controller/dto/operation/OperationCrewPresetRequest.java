package com.icy.icy_backend.controller.dto.operation;

import com.icy.icy_backend.db.entity.event.OperationGroup;
import lombok.Data;

import java.util.List;

@Data
public class OperationCrewPresetRequest {
    private String name;
    private String description;
    private Long shipModelId;
    private Integer capacity;
    private OperationGroup.PositionMode positionMode;
    private List<OperationPositionRequest> positions;
}
