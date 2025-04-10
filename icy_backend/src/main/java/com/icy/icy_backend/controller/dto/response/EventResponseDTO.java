package com.icy.icy_backend.controller.dto.response;

import com.icy.icy_backend.db.entity.Event;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class EventResponseDTO {
    private UUID id;
    private String type;
    private String title;
    private String description;
    private LocalDateTime startDateTime;
    private LocalDateTime endDateTime;
    private LocalDateTime createdAt;
    private boolean finished;

    public EventResponseDTO(Event event) {
        this.id = event.getId();
        this.type = event.getType();
        this.title = event.getTitle();
        this.description = event.getDescription();
        this.startDateTime = event.getStartDateTime();
        this.endDateTime = event.getEndDateTime();
        this.createdAt = event.getCreatedAt();
        this.finished = event.isFinished();
    }
}