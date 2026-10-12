package com.icy.icy_backend.controller.dto.operation;

import lombok.Data;

@Data
public class OperationUpdateRequest {
    private String briefing;
    private String objectives;
    private String meetingPoint;
    private String imageUrl;
    private Boolean allowShipProposals;
    /** Révision lue par le client ; absente, l'écriture n'est pas contrôlée. */
    private Long expectedRevision;
}
