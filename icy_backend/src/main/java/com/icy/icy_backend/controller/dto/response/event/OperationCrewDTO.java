package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.OperationGroup;

import java.util.List;
import java.util.UUID;

/**
 * Ce qu'un groupe « Équipage de vaisseau » ajoute à un groupe ordinaire : modèle attendu, postes et poste de chaque membre.
 * L'effectif, les places et le mode d'affectation restent lus sur le groupe lui-même.
 */
public record OperationCrewDTO(
        Long groupId,
        /** Null si le modèle a disparu du catalogue : le nom enregistré reste affiché. */
        Long shipModelId,
        String shipModelName,
        String shipModelImageUrl,
        OperationGroup.PositionMode positionMode,
        /** Vrai si l'utilisateur peut attribuer les postes des autres membres de cet équipage. */
        boolean manageable,
        List<Position> positions,
        List<Member> members) {

    public record Position(Long id, String label, String icon, Integer capacity, int taken, int sortOrder) {}

    /** positionId null : membre de l'équipage sans poste. */
    public record Member(UUID userId, String username, Long positionId) {}
}
