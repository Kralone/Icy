package com.icy.icy_backend.controller.dto.goal;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class GoalTemplateTreeDTO {
    private String name;
    private String description;
    private Integer target;
    private UUID userId;
    private List<GoalTemplateTreeDTO> subTemplates = new ArrayList<>();
}
