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
        if (!AuthUtils.isAdmin() && !AuthUtils.hasRole("OFFICIER") && !currentUser.equals(group.getResponsibleUserId())) {
            throw new org.springframework.security.access.AccessDeniedException("Responsable non autorisé pour ce groupe");
        }
        if (!approve) { request.setStatus(OperationAssignmentRequest.Status.REFUSED); requestRepository.save(request); return messageService.buildResponse("operation.assignment.refused", null); }
        if (group.getCapacity() != null && assignmentRepository.countByOperationEventIdAndGroupIdAndStatus(request.getOperationEventId(), group.getId(), OperationAssignment.Status.CONFIRMED) >= group.getCapacity()) throw new IllegalStateException("Groupe complet");
        OperationAssignment assignment = assignmentRepository.findByOperationEventIdAndUserId(request.getOperationEventId(), request.getUserId()).orElseGet(OperationAssignment::new);
        assignment.setOperationEventId(request.getOperationEventId()); assignment.setGroupId(request.getGroupId()); assignment.setUserId(request.getUserId()); assignment.setStatus(OperationAssignment.Status.CONFIRMED); assignmentRepository.save(assignment);
        request.setStatus(OperationAssignmentRequest.Status.APPROVED); requestRepository.save(request);
        return messageService.buildResponse("operation.assignment.approved", null);
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
        if (group.getCapacity() != null && assignmentRepository.countByOperationEventIdAndGroupIdAndStatus(operationId, groupId, OperationAssignment.Status.CONFIRMED) >= group.getCapacity()) {
            throw new IllegalStateException("Groupe complet");
        }
        OperationAssignment assignment = assignmentRepository.findByOperationEventIdAndUserId(operationId, userId).orElseGet(OperationAssignment::new);
        assignment.setOperationEventId(operationId); assignment.setGroupId(groupId); assignment.setUserId(userId); assignment.setStatus(OperationAssignment.Status.CONFIRMED);
        assignmentRepository.save(assignment);
        return messageService.buildResponse("operation.assignment.confirmed", null);
    }
}
