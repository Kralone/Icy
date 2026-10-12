package com.icy.icy_backend.controller.dto.response.event;

import com.icy.icy_backend.db.entity.event.OperationGroup;

import java.util.List;
import java.util.UUID;

/** Structure d'une opération telle que l'organisateur la prépare : groupes, effectifs et membres. */
public record OperationOrganizationDTO(OperationGroup.AssignmentMode defaultAssignmentMode, List<Group> groups) {

    public record Member(UUID userId, String username) {}

    public record Group(
            Long id,
            Long parentId,
            String name,
            String description,
            Integer capacity,
            OperationGroup.AssignmentMode assignmentMode,
            OperationGroup.AssignmentMode effectiveMode,
            int sortOrder,
            UUID responsibleUserId,
            String responsibleUsername,
            boolean container,
            /** Membres uniques confirmés du groupe et de ses sous-groupes. */
            int memberCount,
            /** Membres confirmés affectés directement à ce groupe. */
            List<Member> members,
            int pendingRequests) {}
}
