package com.icy.icy_backend.controller.dto.response.goal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GoalTemplateDTO {
    private Long id;
    private String name;
    private String description;
    private int target;
    private LocalDateTime createdAt;
    private Long parentId;
    private UUID userId;
    private String username;
    private List<GoalTemplateDTO> subTemplates;
}
