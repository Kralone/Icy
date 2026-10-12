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
    private String briefing;
    private String objectives;
    private String meetingPoint;
    private String imageUrl;
    private Operation.PublicationStatus publicationStatus;
    private boolean allowShipProposals;
    private long revision;
    private Instant updatedAt;

    public OperationResponseDTO(Event event, Operation operation) {
        this.id = event.getId();
        this.title = event.getTitle();
        this.description = event.getDescription();
        this.startDateTime = event.getStartDateTime();
        this.endDateTime = event.getEndDateTime();
        this.finished = event.isFinished();
        this.briefing = operation.getBriefing();
        this.objectives = operation.getObjectives();
        this.meetingPoint = operation.getMeetingPoint();
        this.imageUrl = operation.getImageUrl();
        this.publicationStatus = operation.getPublicationStatus();
        this.allowShipProposals = operation.isAllowShipProposals();
        this.revision = operation.getRevision();
        this.updatedAt = operation.getUpdatedAt() == null ? null : operation.getUpdatedAt().atZone(ZoneId.systemDefault()).toInstant();
    }
}
