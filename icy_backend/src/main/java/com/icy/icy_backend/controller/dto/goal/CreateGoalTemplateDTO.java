package com.icy.icy_backend.controller.dto.goal;

import lombok.Data;

import java.util.UUID;

@Data
public class CreateGoalTemplateDTO {
    private String name;
    private String description;
    private Integer target;
    private Long parentId;
    private UUID userId;
}
