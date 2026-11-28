package com.icy.icy_backend.service.companion;

import com.icy.icy_backend.controller.companion.CompanionMembershipDTO;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.entity.event.OperationAssignment;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.ForbiddenException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.pole.PoleAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Accès du compagnon aux opérations en direct.
 * <ul>
 *   <li>Envoyer son état (santé, pouls…) : participant confirmé, ou affecté à un groupe de l'opération.</li>
 *   <li>Suivre l'état du groupe : un participant, ou un organisateur de l'opération.</li>
 * </ul>
 * Un brouillon n'existe que pour ses organisateurs ; une opération terminée ne reçoit plus d'état.
 */
@Service
public class CompanionMembershipService {
    static final int CONFIRMED = 1;

    private final OperationRepository operations;
    private final EventParticipationRepository participations;
    private final OperationAssignmentRepository assignments;
    private final UserRepository users;

    public CompanionMembershipService(OperationRepository operations, EventParticipationRepository participations,
                                      OperationAssignmentRepository assignments, UserRepository users) {
        this.operations = operations;
        this.participations = participations;
        this.assignments = assignments;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public CompanionMembershipDTO membership(UUID operationId) {
        boolean organizer = PoleAccess.organizes(operationId);
        Operation operation = operations.findById(operationId)
                .filter(o -> o.getPublicationStatus() == Operation.PublicationStatus.PUBLISHED || organizer)
                .orElseThrow(() -> new ResourceNotFoundException("Opération introuvable"));
        UUID userId = AuthUtils.getCurrentUserId();
        User user = users.findById(userId).orElseThrow(() -> new ResourceNotFoundException("Membre introuvable"));

        boolean participant = participations.existsByEvent_IdAndUser_IdAndStatus(operationId, userId, CONFIRMED)
                || assignments.findByOperationEventId(operationId).stream()
                .anyMatch(a -> userId.equals(a.getUserId()) && a.getStatus() == OperationAssignment.Status.CONFIRMED);
        boolean finished = operation.getEvent() != null && operation.getEvent().isFinished();
        boolean canReport = participant && !finished;
        boolean canView = participant || organizer;
        if (!canReport && !canView) throw new ForbiddenException("Tu ne participes pas à cette opération.");

        String name = operation.getEvent() == null ? null : operation.getEvent().getTitle();
        return new CompanionMembershipDTO(operationId, name, userId, user.getUsername(), canReport, canView);
    }
}
