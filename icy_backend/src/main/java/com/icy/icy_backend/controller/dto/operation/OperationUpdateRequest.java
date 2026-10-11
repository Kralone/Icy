package com.icy.icy_backend.controller.dto.operation;

import lombok.Data;

@Data
public class OperationUpdateRequest {
    private String briefing;
    private String meetingPoint;
    private String imageUrl;
}
