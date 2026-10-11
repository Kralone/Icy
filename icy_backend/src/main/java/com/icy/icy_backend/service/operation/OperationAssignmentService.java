package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.event.*;
import com.icy.icy_backend.db.repository.event.*;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.common.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import java.util.List;
import java.util.Set;
import java.util.HashSet;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor
public class OperationAssignmentService {
    private final OperationRepository operationRepository;
    private final OperationGroupRepository groupRepository;
    private final OperationAssignmentRepository assignmentRepository;
    private final EventRepository eventRepository;
    private final EventParticipationRepository participationRepository;
    private final MessageService messageService;
    private final OperationAssignmentRequestRepository requestRepository;

    @Transactional
    public ResponseEntity<MessageResponse<Void>> request(UUID operationId, Long groupId) {
        Operation operation = operationRepository.findById(operationId).filter(value -> value.getPublicationStatus() == Operation.PublicationStatus.PUBLISHED).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        OperationGroup group = groupRepository.findLockedById(groupId).orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"));
        if (!operationId.equals(group.getOperationEventId()) || groupRepository.existsByParentId(groupId)) throw new IllegalArgumentException("Groupe feuille invalide");
        if (group.getAssignmentMode() != OperationGroup.AssignmentMode.VALIDATION) throw new IllegalStateException("Ce groupe ne demande pas de validation");
        UUID user = AuthUtils.getCurrentUserId();
        if (!participationRepository.existsByEvent_IdAndUser_IdAndStatus(operationId, user, 1)) throw new IllegalStateException("La participation Présent est requise");
        if (requestRepository.findFirstByOperationEventIdAndUserIdAndStatusOrderByCreatedAtDesc(operationId, user, OperationAssignmentRequest.Status.PENDING).isPresent()) throw new IllegalStateException("Demande déjà en attente");
        requestRepository.save(OperationAssignmentRequest.builder().operationEventId(operationId).groupId(groupId).userId(user).build());
        return messageService.buildResponse("operation.assignment.requested", null);
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> decide(UUID requestId, boolean approve) {
        OperationAssignmentRequest request = requestRepository.findById(requestId).orElseThrow(() -> new ResourceNotFoundException("Demande introuvable"));
        if (request.getStatus() != OperationAssignmentRequest.Status.PENDING) throw new IllegalStateException("Demande déjà traitée");
        OperationGroup group = groupRepository.findLockedById(request.getGroupId()).orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"));
        UUID currentUser = AuthUtils.getCurrentUserId();
        if (!AuthUtils.isAdmin() && !AuthUtils.hasRole("OFFICIER") && !hasResponsibleScope(currentUser, group)) {
            throw new org.springframework.security.access.AccessDeniedException("Responsable non autorisé pour ce groupe");
        }
        if (!approve) { request.setStatus(OperationAssignmentRequest.Status.REFUSED); requestRepository.save(request); return messageService.buildResponse("operation.assignment.refused", null); }
        ensureCapacity(request.getOperationEventId(), group.getId(), request.getUserId());
        OperationAssignment assignment = assignmentRepository.findByOperationEventIdAndUserId(request.getOperationEventId(), request.getUserId()).orElseGet(OperationAssignment::new);
        assignment.setOperationEventId(request.getOperationEventId()); assignment.setGroupId(request.getGroupId()); assignment.setUserId(request.getUserId()); assignment.setStatus(OperationAssignment.Status.CONFIRMED); assignmentRepository.save(assignment);
        request.setStatus(OperationAssignmentRequest.Status.APPROVED); requestRepository.save(request);
        return messageService.buildResponse("operation.assignment.approved", null);
    }

    private boolean hasResponsibleScope(UUID userId, OperationGroup target) {
        OperationGroup cursor = target;
        int depth = 0;
        while (cursor != null && depth++ < 2) {
            if (userId.equals(cursor.getResponsibleUserId())) return true;
            cursor = cursor.getParentId() == null ? null : groupRepository.findById(cursor.getParentId()).orElse(null);
        }
        return false;
    }

    /**
     * Returns the assignment queue visible to the current user. Organizers see
     * the complete operation queue; a delegated responsible sees requests for
     * their group and its descendants only.
     */
    @Transactional(readOnly = true)
    public List<OperationAssignmentRequest> visibleRequests(UUID operationId) {
        operationRepository.findById(operationId).orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        List<OperationAssignmentRequest> requests = requestRepository.findByOperationEventIdOrderByCreatedAtAsc(operationId);
        if (AuthUtils.isAdmin() || AuthUtils.hasRole("OFFICIER")) return requests;

        UUID currentUser = AuthUtils.getCurrentUserId();
        List<OperationGroup> groups = groupRepository.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId);
        Set<Long> visibleGroups = groups.stream()
                .filter(group -> currentUser.equals(group.getResponsibleUserId()))
                .map(OperationGroup::getId)
                .collect(Collectors.toCollection(HashSet::new));
        boolean changed;
        do {
            changed = false;
            for (OperationGroup group : groups) {
                if (group.getParentId() != null && visibleGroups.contains(group.getParentId()) && visibleGroups.add(group.getId())) {
                    changed = true;
                }
            }
        } while (changed);
        return requests.stream().filter(request -> visibleGroups.contains(request.getGroupId())).toList();
    }

    @Transactional
    public ResponseEntity<MessageResponse<Void>> assign(UUID operationId, Long groupId) {
        Operation operation = operationRepository.findById(operationId)
                .filter(value -> value.getPublicationStatus() == Operation.PublicationStatus.PUBLISHED)
                .orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        OperationGroup group = groupRepository.findLockedById(groupId).orElseThrow(() -> new ResourceNotFoundException("Groupe introuvable"));
        if (!operationId.equals(group.getOperationEventId()) || groupRepository.existsByParentId(groupId)) {
            throw new IllegalArgumentException("Affectation possible uniquement sur une feuille");
        }
        UUID userId = AuthUtils.getCurrentUserId();
        Event event = eventRepository.findById(operationId).orElseThrow();
        if (!participationRepository.existsByEvent_IdAndUser_IdAndStatus(operationId, userId, 1)) {
            throw new IllegalStateException("La participation Présent est requise");
        }
        if (group.getAssignmentMode() == OperationGroup.AssignmentMode.MANAGED) throw new IllegalStateException("Groupe géré par les organisateurs");
        if (group.getAssignmentMode() == OperationGroup.AssignmentMode.VALIDATION) throw new IllegalStateException("Une demande de validation sera disponible dans l’éditeur");
        ensureCapacity(operationId, groupId, userId);
        OperationAssignment assignment = assignmentRepository.findByOperationEventIdAndUserId(operationId, userId).orElseGet(OperationAssignment::new);
        assignment.setOperationEventId(operationId); assignment.setGroupId(groupId); assignment.setUserId(userId); assignment.setStatus(OperationAssignment.Status.CONFIRMED);
        assignmentRepository.save(assignment);
        return messageService.buildResponse("operation.assignment.confirmed", null);
    }

    /** Enforces capacities on the selected leaf and every capacity-bearing ancestor. */
    private void ensureCapacity(UUID operationId, Long leafId, UUID userId) {
        List<OperationGroup> groups = groupRepository.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId);
        java.util.Map<Long, OperationGroup> byId = groups.stream().collect(Collectors.toMap(OperationGroup::getId, java.util.function.Function.identity()));
        Set<Long> ancestors = new HashSet<>();
        Long cursor = leafId;
        while (cursor != null && ancestors.add(cursor)) cursor = byId.get(cursor) == null ? null : byId.get(cursor).getParentId();
        List<OperationAssignment> assignments = assignmentRepository.findByOperationEventId(operationId);
        for (Long groupId : ancestors) {
            OperationGroup group = byId.get(groupId);
            Set<Long> subtree = groups.stream().filter(candidate -> isDescendantOrSelf(candidate, groupId, byId)).map(OperationGroup::getId).collect(Collectors.toSet());
            Set<UUID> assignedUsers = assignments.stream()
                    .filter(assignment -> assignment.getStatus() == OperationAssignment.Status.CONFIRMED && subtree.contains(assignment.getGroupId()))
                    .map(OperationAssignment::getUserId).collect(Collectors.toSet());
            if (group != null && group.getCapacity() != null && assignedUsers.size() >= group.getCapacity() && !assignedUsers.contains(userId)) {
                throw new IllegalStateException("Groupe complet");
            }
        }
    }

    private boolean isDescendantOrSelf(OperationGroup candidate, Long ancestorId, java.util.Map<Long, OperationGroup> byId) {
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
