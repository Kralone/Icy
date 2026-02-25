package com.icy.icy_backend.controller.dto.response.goal;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class GoalParticipationSummaryDTO {
    private UUID userId;
    private String username;
    private String avatarUrl;
    private int totalDelta;
    private double percentOfCurrent;
}
