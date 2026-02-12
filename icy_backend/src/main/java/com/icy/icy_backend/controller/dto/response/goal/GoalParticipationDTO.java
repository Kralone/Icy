package com.icy.icy_backend.controller.dto.response.goal;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class GoalParticipationDTO {
    private UUID id;
    private Long goalId;
    private UUID userId;
    private String username;
    private String avatarUrl;
    private int delta;
    private int totalAfter;
    private LocalDateTime createdAt;
}
