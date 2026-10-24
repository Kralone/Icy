package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.entity.event.OperationGroupPosition;
import com.icy.icy_backend.db.entity.event.OperationShipRequirement;
import com.icy.icy_backend.db.repository.event.OperationGroupPositionRepository;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationShipRequirementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Replanifier une opération : le nouveau brouillon reprend son organisation (groupes, équipages et leurs postes, besoins de vaisseaux),
 * sans les inscriptions, affectations, demandes ni vaisseaux proposés, qui appartiennent à l'opération d'origine.
 */
@Service
@RequiredArgsConstructor
public class OperationReplanService {
    private final OperationGroupRepository groupRepository;
    private final OperationGroupPositionRepository positionRepository;
    private final OperationShipRequirementRepository requirementRepository;

    @Transactional
    public void copyOrganization(UUID sourceId, UUID targetId) {
        List<OperationGroup> groups = groupRepository.findByOperationEventIdOrderBySortOrderAscIdAsc(sourceId);
        Map<Long, Long> copies = new HashMap<>();
        // Deux niveaux au plus : les groupes principaux d'abord, pour que chaque sous-groupe retrouve son parent copié.
        groups.stream().filter(group -> group.getParentId() == null).forEach(group -> copies.put(group.getId(), copyGroup(group, targetId, null).getId()));
        groups.stream().filter(group -> group.getParentId() != null && copies.containsKey(group.getParentId()))
                .forEach(group -> copies.put(group.getId(), copyGroup(group, targetId, copies.get(group.getParentId())).getId()));
        if (!copies.isEmpty()) {
            for (OperationGroupPosition position : positionRepository.findByGroupIdInOrderBySortOrderAscIdAsc(copies.keySet())) {
                positionRepository.save(OperationGroupPosition.builder().groupId(copies.get(position.getGroupId()))
                        .label(position.getLabel()).icon(position.getIcon()).capacity(position.getCapacity()).sortOrder(position.getSortOrder()).build());
            }
        }
        // Un besoin annulé ne sert plus ; les autres repartent ouverts, aucun vaisseau n'étant encore proposé.
        for (OperationShipRequirement requirement : requirementRepository.findByOperationEventIdOrderByCreatedAtAsc(sourceId)) {
            if (requirement.getStatus() == OperationShipRequirement.Status.CANCELLED) continue;
            if (requirement.getGroupId() != null && !copies.containsKey(requirement.getGroupId())) continue;
            requirementRepository.save(OperationShipRequirement.builder().operationEventId(targetId)
                    .groupId(requirement.getGroupId() == null ? null : copies.get(requirement.getGroupId()))
                    .shipModelId(requirement.getShipModelId()).quantity(requirement.getQuantity()).notes(requirement.getNotes()).build());
        }
    }

    private OperationGroup copyGroup(OperationGroup source, UUID targetId, Long parentId) {
        return groupRepository.save(OperationGroup.builder().operationEventId(targetId).parentId(parentId)
                .name(source.getName()).description(source.getDescription()).capacity(source.getCapacity())
                .assignmentMode(source.getAssignmentMode()).sortOrder(source.getSortOrder()).responsibleUserId(source.getResponsibleUserId())
                .kind(source.getKind()).shipModelId(source.getShipModelId()).shipModelName(source.getShipModelName())
                .positionMode(source.getPositionMode()).crewPresetId(source.getCrewPresetId()).build());
    }
}
