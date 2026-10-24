package com.icy.icy_backend.controller.dto.response.goal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GoalMemberDTO {
    private UUID userId;
    private String username;
    private String avatarUrl;
    private LocalDateTime joinedAt;
}
