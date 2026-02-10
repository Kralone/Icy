package com.icy.icy_backend.controller.dto.goal;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class GoalTemplateTreeDTO {
    private String name;
    private String description;
    private Integer target;
    private List<GoalTemplateTreeDTO> subTemplates = new ArrayList<>();
}
