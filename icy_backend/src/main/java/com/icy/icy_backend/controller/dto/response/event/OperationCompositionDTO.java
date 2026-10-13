package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.OperationGroup;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Composition d'une opération publiée, telle que la voit un participant : tous les groupes, leurs membres,
 * et sa propre situation (groupe, demande en attente). Aucune action n'en dépend : le serveur recontrôle chaque écriture.
 */
public record OperationCompositionDTO(
        /** Vrai si l'utilisateur est inscrit Présent : c'est la condition pour recevoir une affectation. */
        boolean present,
        Long myGroupId,
        MyRequest myRequest,
        List<Group> groups) {

    public record Member(UUID userId, String username) {}

    public record Group(
            Long id,
            Long parentId,
            String name,
            String description,
            Integer capacity,
            OperationGroup.AssignmentMode effectiveMode,
            boolean container,
            int memberCount,
            /** Places restantes, plafond du parent compris ; null sans limite. */
            Integer freeSeats,
            /** Places restantes selon la seule capacité du groupe : la limite pour un membre déjà compté dans le même parent. */
            Integer ownFreeSeats,
            String responsibleUsername,
            List<Member> members) {}

    /** Demande en attente de l'utilisateur ; s'il a déjà un groupe, il le garde jusqu'à l'acceptation. */
    public record MyRequest(UUID id, Long groupId, String groupName, Instant createdAt) {}
}
