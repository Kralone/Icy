package com.icy.icy_backend.controller.dto.goal;

import lombok.Data;

import java.util.UUID;

@Data
public class ApplyGoalTemplateDTO {
    private UUID userId;
    private Long parentGoalId;
}
