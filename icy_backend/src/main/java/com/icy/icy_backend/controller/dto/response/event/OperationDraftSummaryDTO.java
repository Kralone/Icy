package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.EventType;
import com.icy.icy_backend.db.entity.event.Operation;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;

/** Ligne de la liste des brouillons : de quoi reconnaître l'opération et reprendre son édition. */
@Data
public class OperationDraftSummaryDTO {
    private UUID id;
    private String title;
    private String type;
    private String typeTextColor;
    private String typeBackgroundColor;
    private String typeImageUrl;
    private LocalDateTime startDateTime;
    private LocalDateTime endDateTime;
    private Instant updatedAt;

    public OperationDraftSummaryDTO(Operation operation) {
        Event event = operation.getEvent();
        EventType eventType = event.getType();
        this.id = event.getId();
        this.title = event.getTitle();
        if (eventType != null) {
            this.type = eventType.getName();
            this.typeTextColor = eventType.getTextColor();
            this.typeBackgroundColor = eventType.getBackgroundColor();
            this.typeImageUrl = eventType.getImageUrl();
        }
        this.startDateTime = event.getStartDateTime();
        this.endDateTime = event.getEndDateTime();
        this.updatedAt = operation.getUpdatedAt() == null ? null : operation.getUpdatedAt().atZone(ZoneId.systemDefault()).toInstant();
    }
}
