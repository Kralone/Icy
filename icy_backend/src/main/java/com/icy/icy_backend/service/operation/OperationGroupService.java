package com.icy.icy_backend.service.operation;
import com.icy.icy_backend.controller.dto.operation.OperationGroupRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.OperationGroupResponseDTO;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import java.util.List;
@Service @RequiredArgsConstructor
public class OperationGroupService {
    private final OperationRepository operationRepository;
    private final OperationGroupRepository groupRepository;
    private final MessageService messageService;
    private final OperationAssignmentRepository assignmentRepository;
    @Transactional
    public ResponseEntity<MessageResponse<OperationGroupResponseDTO>> create(UUID operationId, OperationGroupRequest request) {
        if (request.getName() == null || request.getName().isBlank() || request.getName().length() > 120) throw new IllegalArgumentException("Nom de groupe invalide");
        if (request.getDescription() != null && request.getDescription().length() > 5000) throw new IllegalArgumentException("Description trop longue");
        if (request.getCapacity() != null && (request.getCapacity() < 0 || request.getCapacity() > 10000)) throw new IllegalArgumentException("Capacité invalide");
        if (request.getAssignmentMode() == null) throw new IllegalArgumentException("Mode d’affectation requis");
        if (request.getSortOrder() < 0 || request.getSortOrder() > 10000) throw new IllegalArgumentException("Ordre invalide");
        operationRepository.findById(operationId).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        if (request.getParentId() != null) {
            OperationGroup parent = groupRepository.findById(request.getParentId()).orElseThrow(() -> new ResourceNotFoundException("Groupe parent introuvable"));
            if (!operationId.equals(parent.getOperationEventId())) throw new IllegalArgumentException("Le groupe parent appartient à une autre opération");
            if (parent.getParentId() != null) throw new IllegalArgumentException("Deux niveaux de groupes maximum");
        }
        OperationGroup group = OperationGroup.builder().operationEventId(operationId).parentId(request.getParentId()).name(request.getName().trim()).description(request.getDescription()).capacity(request.getCapacity()).assignmentMode(request.getAssignmentMode()).sortOrder(request.getSortOrder()).responsibleUserId(request.getResponsibleUserId()).build();
        operationRepository.markModified(operationId, java.time.LocalDateTime.now());
        return messageService.buildResponse("operation.group.created", new OperationGroupResponseDTO(groupRepository.save(group)));
    }

    @Transactional
    public ResponseEntity<MessageResponse<OperationGroupResponseDTO>> update(UUID operationId, Long groupId, OperationGroupRequest request) {
        OperationGroup group = groupRepository.findById(groupId).orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"));
        if (!operationId.equals(group.getOperationEventId())) throw new ResourceNotFoundException("Groupe introuvable");
        if (request.getName() == null || request.getName().isBlank() || request.getName().length() > 120) throw new IllegalArgumentException("Nom de groupe invalide");
        if (request.getDescription() != null && request.getDescription().length() > 5000) throw new IllegalArgumentException("Description trop longue");
        if (request.getCapacity() != null && (request.getCapacity() < 0 || request.getCapacity() > 10000)) throw new IllegalArgumentException("Capacité invalide");
        if (request.getCapacity() != null && request.getCapacity() < confirmedAssignmentCount(operationId, groupId)) throw new IllegalArgumentException("La capacité ne peut pas être inférieure aux affectations confirmées");
        if (request.getAssignmentMode() == null) throw new IllegalArgumentException("Mode d’affectation requis");
        if (request.getSortOrder() < 0 || request.getSortOrder() > 10000) throw new IllegalArgumentException("Ordre invalide");
        if (request.getParentId() != null) {
            OperationGroup parent = groupRepository.findById(request.getParentId()).orElseThrow(() -> new ResourceNotFoundException("Groupe parent introuvable"));
            if (!operationId.equals(parent.getOperationEventId()) || groupId.equals(parent.getId()) || parent.getParentId() != null) throw new IllegalArgumentException("Groupe parent invalide");
        }
        group.setName(request.getName().trim()); group.setDescription(request.getDescription()); group.setCapacity(request.getCapacity());
        group.setParentId(request.getParentId()); group.setAssignmentMode(request.getAssignmentMode()); group.setSortOrder(request.getSortOrder());
        group.setResponsibleUserId(request.getResponsibleUserId());
        operationRepository.markModified(operationId, java.time.LocalDateTime.now());
        return messageService.buildResponse("operation.group.updated", new OperationGroupResponseDTO(groupRepository.save(group)));
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> delete(UUID operationId, Long groupId) {
        OperationGroup group = groupRepository.findById(groupId).orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"));
        if (!operationId.equals(group.getOperationEventId())) throw new ResourceNotFoundException("Groupe introuvable");
        if (groupRepository.existsByParentId(groupId)) throw new IllegalStateException("Supprimez d’abord les sous-groupes");
        groupRepository.delete(group);
        operationRepository.markModified(operationId, java.time.LocalDateTime.now());
        return messageService.buildResponse("operation.group.deleted", null);
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> reorder(UUID operationId, List<Long> groupIds) {
        if (groupIds == null || groupIds.isEmpty() || groupIds.size() > 100 || groupIds.stream().anyMatch(java.util.Objects::isNull) || groupIds.stream().distinct().count() != groupIds.size()) {
            throw new IllegalArgumentException("Ordre de groupes invalide");
        }
        List<OperationGroup> groups = groupIds.stream().map(id -> groupRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"))).toList();
        if (groups.stream().anyMatch(group -> !operationId.equals(group.getOperationEventId()))) throw new IllegalArgumentException("Les groupes appartiennent à une autre opération");
        Long expectedParent = groups.get(0).getParentId();
        if (groups.stream().anyMatch(group -> !java.util.Objects.equals(expectedParent, group.getParentId()))) throw new IllegalArgumentException("Seuls les groupes frères peuvent être réordonnés");
        java.util.Set<Long> expectedIds = operationGroupIds(operationId, expectedParent);
        if (!expectedIds.equals(new java.util.HashSet<>(groupIds))) throw new IllegalArgumentException("La liste doit contenir tous les groupes frères");
        for (int index = 0; index < groups.size(); index++) { groups.get(index).setSortOrder(index); groupRepository.save(groups.get(index)); }
        operationRepository.markModified(operationId, java.time.LocalDateTime.now());
        return messageService.buildResponse("operation.group.reordered", null);
    }

    private java.util.Set<Long> operationGroupIds(UUID operationId, Long parentId) {
        return groupRepository.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId).stream()
                .filter(group -> java.util.Objects.equals(parentId, group.getParentId()))
                .map(OperationGroup::getId).collect(java.util.stream.Collectors.toSet());
    }

    private long confirmedAssignmentCount(UUID operationId, Long groupId) {
        List<OperationGroup> groups = groupRepository.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId);
        java.util.Set<Long> subtree = groups.stream()
                .filter(candidate -> isDescendantOrSelf(candidate, groupId, groups))
                .map(OperationGroup::getId).collect(java.util.stream.Collectors.toSet());
        return assignmentRepository.findByOperationEventId(operationId).stream()
                .filter(assignment -> assignment.getStatus() == com.icy.icy_backend.db.entity.event.OperationAssignment.Status.CONFIRMED && subtree.contains(assignment.getGroupId()))
                .map(com.icy.icy_backend.db.entity.event.OperationAssignment::getUserId).distinct().count();
    }

    private boolean isDescendantOrSelf(OperationGroup candidate, Long ancestorId, List<OperationGroup> groups) {
        java.util.Map<Long, OperationGroup> byId = groups.stream().collect(java.util.stream.Collectors.toMap(OperationGroup::getId, java.util.function.Function.identity()));
        Long cursor = candidate.getId();
        int depth = 0;
        while (cursor != null && depth++ <= 2) {
            if (ancestorId.equals(cursor)) return true;
            OperationGroup current = byId.get(cursor);
            cursor = current == null ? null : current.getParentId();
        }
        return false;
    }
}
