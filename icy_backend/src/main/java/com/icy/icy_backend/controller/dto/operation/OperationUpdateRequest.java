package com.icy.icy_backend.controller.dto.operation;

import lombok.Data;

@Data
public class OperationUpdateRequest {
    private String briefing;
    private String objectives;
    private String meetingPoint;
    private String imageUrl;
    private Boolean allowShipProposals;
    /** Session de minage : absent, inchangé. Coché sur une opération publiée, la fiche de minage liée est créée. */
    private Boolean miningSession;
    /** Session de salvage : même règle, avec une fiche de salvage. Les deux options ne peuvent pas être cochées ensemble. */
    private Boolean salvageSession;
    /** Absent : inchangé. INHERITED n'a pas de sens au niveau de l'opération. */
    private com.icy.icy_backend.db.entity.event.OperationGroup.AssignmentMode defaultAssignmentMode;
    /** Révision lue par le client ; absente, l'écriture n'est pas contrôlée. */
    private Long expectedRevision;
}
