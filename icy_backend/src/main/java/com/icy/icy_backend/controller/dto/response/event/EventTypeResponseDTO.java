package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.EventType;
import lombok.Getter;

/** Type d'événement et nombre d'activités qui l'utilisent ; un type utilisé s'archive au lieu d'être supprimé. */
@Getter
public class EventTypeResponseDTO {
    private final String name;
    private final String textColor;
    private final String backgroundColor;
    private final String imageUrl;
    private final boolean archived;
    private final long usageCount;

    public EventTypeResponseDTO(EventType type, long usageCount) {
        this.name = type.getName();
        this.textColor = type.getTextColor();
        this.backgroundColor = type.getBackgroundColor();
        this.imageUrl = type.getImageUrl();
        this.archived = type.isArchived();
        this.usageCount = usageCount;
    }
}
