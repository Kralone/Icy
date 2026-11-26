package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.EventType;
import com.icy.icy_backend.db.entity.event.ActivityType;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class EventResponseDTO {
    private UUID id;
    private EventType type;
    private String title;
    private String description;
    private LocalDateTime startDateTime;
    private LocalDateTime endDateTime;
    private LocalDateTime createdAt;
    private boolean finished;
    private ActivityType activityType;
    /** Renseigné dans la liste de gestion : opération pas encore publiée, invisible des membres. */
    private boolean draft;
    /** Pôles rattachés, dans l'ordre d'affichage ; vide si aucun. */
    private java.util.List<String> poles;
    /** Premier pôle rattaché, ou null : ancien champ, gardé pour les écrans pas encore rechargés. */
    private String pole;

    public EventResponseDTO(Event event) {
        this.id = event.getId();
        this.type = event.getType();
        this.title = event.getTitle();
        this.description = event.getDescription();
        this.startDateTime = event.getStartDateTime();
        this.endDateTime = event.getEndDateTime();
        this.createdAt = event.getCreatedAt();
        this.finished = event.isFinished();
        this.activityType = event.getActivityType();
        this.poles = event.sortedPoles().stream().map(Enum::name).toList();
        this.pole = this.poles.isEmpty() ? null : this.poles.get(0);
    }
}





