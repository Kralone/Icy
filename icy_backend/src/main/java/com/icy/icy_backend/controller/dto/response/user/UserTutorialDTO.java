package com.icy.icy_backend.controller.dto.response.user;

import com.icy.icy_backend.db.entity.user.UserTutorial;

import java.time.LocalDateTime;

public record UserTutorialDTO(String tutorialId, int version, String status, LocalDateTime updatedAt) {
    public static UserTutorialDTO from(UserTutorial tutorial) {
        return new UserTutorialDTO(tutorial.getTutorialId(), tutorial.getVersion(), tutorial.getStatus().name(), tutorial.getUpdatedAt());
    }
}
