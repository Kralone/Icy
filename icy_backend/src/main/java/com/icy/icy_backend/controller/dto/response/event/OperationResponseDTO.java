package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.Operation;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;

@Data
public class OperationResponseDTO {
    private UUID id;
    private String title;
    private String description;
    private LocalDateTime startDateTime;
    private LocalDateTime endDateTime;
    private boolean finished;
    /** Heure de fin atteinte (horloge du serveur) : l'organisation n'est plus modifiable. */
    private boolean locked;
    /** Heure de début atteinte (horloge du serveur, heure de Paris) : l'opération est en cours tant qu'elle n'est pas terminée. */
    private boolean started;
    private String briefing;
    private String objectives;
    private String meetingPoint;
    private String imageUrl;
    private Operation.PublicationStatus publicationStatus;
    private boolean allowShipProposals;
    private boolean miningSession;
    private long revision;
    private com.icy.icy_backend.db.entity.event.OperationGroup.AssignmentMode defaultAssignmentMode;
    private Instant updatedAt;
    /** Type d'événement : son nom, ses couleurs et son image habillent la fiche. */
    private String typeName;
    private String typeTextColor;
    private String typeBackgroundColor;
    private String typeImageUrl;

    public OperationResponseDTO(Event event, Operation operation) {
        this.id = event.getId();
        this.title = event.getTitle();
        this.description = event.getDescription();
        this.startDateTime = event.getStartDateTime();
        this.endDateTime = event.getEndDateTime();
        this.finished = event.isFinished();
        this.locked = com.icy.icy_backend.service.operation.OperationLock.isClosed(event, operation);
        this.started = com.icy.icy_backend.service.operation.OperationLock.isClosed(event.getStartDateTime(), LocalDateTime.now(com.icy.icy_backend.service.operation.OperationLock.ZONE));
        this.briefing = operation.getBriefing();
        this.objectives = operation.getObjectives();
        this.meetingPoint = operation.getMeetingPoint();
        this.imageUrl = operation.getImageUrl();
        this.publicationStatus = operation.getPublicationStatus();
        this.allowShipProposals = operation.isAllowShipProposals();
        this.miningSession = operation.isMiningSession();
        this.revision = operation.getRevision();
        this.defaultAssignmentMode = operation.getDefaultAssignmentMode();
        com.icy.icy_backend.db.entity.event.EventType type = event.getType();
        if (type != null) {
            this.typeName = type.getName();
            this.typeTextColor = type.getTextColor();
            this.typeBackgroundColor = type.getBackgroundColor();
            this.typeImageUrl = type.getImageUrl();
        }
        this.updatedAt = operation.getUpdatedAt() == null ? null : operation.getUpdatedAt().atZone(ZoneId.systemDefault()).toInstant();
    }
}
