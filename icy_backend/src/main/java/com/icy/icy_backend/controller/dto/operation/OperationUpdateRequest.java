package com.icy.icy_backend.controller.dto.operation;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class OperationUpdateRequest {
    @Size(max = 50000)
    private String briefing;
    @Size(max = 255)
    private String meetingPoint;
    @Size(max = 2000)
    private String imageUrl;
}
