package com.icy.icy_backend.controller.dto.response.goal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GoalDTO {
    private Long id;
    private String name;
    private String description;
    private int target;
    private int current;
    private boolean pinned;
    private boolean completed;
    private LocalDateTime createdAt;
    private Long parentId;
    private List<GoalDTO> subGoals;
}



