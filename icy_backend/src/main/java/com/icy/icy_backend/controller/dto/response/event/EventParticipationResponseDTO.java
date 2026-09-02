package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.EventParticipation;
import com.icy.icy_backend.db.entity.user.User;

import java.util.UUID;

public record EventParticipationResponseDTO(
        UUID id,
        UUID eventId,
        ParticipantDTO user,
        int status
) {
    public EventParticipationResponseDTO(EventParticipation participation) {
        this(
                participation.getId(),
                participation.getEvent() == null ? null : participation.getEvent().getId(),
                participation.getUser() == null ? null : new ParticipantDTO(participation.getUser()),
                participation.getStatus()
        );
    }

    public record ParticipantDTO(UUID id, String username, String avatarUrl) {
        public ParticipantDTO(User user) {
            this(user.getId(), user.getUsername(), user.getAvatarUrl());
        }
    }
}
