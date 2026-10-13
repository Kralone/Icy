package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.OperationGroup;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Tableau de coordination d'une opération : qui vient, qui n'a pas de place, qui attend une réponse.
 * Un organisateur voit tout ; un responsable ne peut agir que sur les groupes marqués « manageable ».
 */
public record OperationCoordinationDTO(
        boolean organizer,
        List<Member> present,
        List<Member> maybe,
        List<Member> unavailable,
        List<Member> unassigned,
        List<Group> groups,
        List<Request> requests) {

    public record Member(UUID userId, String username) {}

    public record Group(
            Long id,
            Long parentId,
            String name,
            Integer capacity,
            OperationGroup.AssignmentMode effectiveMode,
            boolean container,
            int memberCount,
            /** Places restantes, plafond du parent compris ; null sans limite. */
            Integer freeSeats,
            /** Places restantes selon la seule capacité du groupe : c'est la limite pour un membre déjà compté dans le même parent. */
            Integer ownFreeSeats,
            String responsibleUsername,
            boolean manageable,
            List<Member> members) {}

    public record Request(
            UUID id,
            Member member,
            Long groupId,
            String groupName,
            Long currentGroupId,
            /** Groupe actuel du membre s'il demande un transfert : il le garde jusqu'à l'acceptation. */
            String currentGroupName,
            Instant createdAt) {}
}
