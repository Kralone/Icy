package com.icy.icy_backend.controller.dto.event;

import lombok.Getter;

import java.util.UUID;

@Getter
public class EventParticipationRequest {
    private UUID eventId;
    private int status;
}



