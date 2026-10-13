package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.controller.dto.operation.OperationGroupRequest;
import com.icy.icy_backend.controller.dto.operation.OperationShipRequirementRequest;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.entity.event.OperationAssignment;
import com.icy.icy_backend.db.entity.event.OperationAssignmentRequest;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.entity.event.OperationShipProposal;
import com.icy.icy_backend.db.entity.event.OperationShipRequirement;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRequestRepository;
import com.icy.icy_backend.db.repository.event.OperationGroupRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.event.OperationShipProposalRepository;
import com.icy.icy_backend.db.repository.event.OperationShipRequirementRepository;
import com.icy.icy_backend.db.repository.user.UserShipRepository;
import com.icy.icy_backend.exception.definition.OperationClosedException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.UserAuthDetails;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Lot 3C : clôture automatique à l'heure de fin, et vaisseaux proposés (acceptation, refus, retrait). */
class OperationFleetAndClosureTest {
    private static final LocalDateTime END = LocalDateTime.of(2026, 10, 12, 22, 0, 0);

    private final UUID operationId = UUID.randomUUID();
    private final UUID organizerId = UUID.randomUUID();
    private final UUID responsibleId = UUID.randomUUID();
    private final UUID memberId = UUID.randomUUID();
    private final UUID ownerId = UUID.randomUUID();

    private final OperationRepository operations = mock(OperationRepository.class);
    private final EventRepository events = mock(EventRepository.class);
    private final OperationGroupRepository groups = mock(OperationGroupRepository.class);
    private final OperationAssignmentRepository assignments = mock(OperationAssignmentRepository.class);
    private final OperationAssignmentRequestRepository requests = mock(OperationAssignmentRequestRepository.class);
    private final EventParticipationRepository participation = mock(EventParticipationRepository.class);
    private final UserShipRepository hangar = mock(UserShipRepository.class);
    private final OperationShipProposalRepository proposals = mock(OperationShipProposalRepository.class);
    private final OperationShipRequirementRepository requirements = mock(OperationShipRequirementRepository.class);

    private final Operation operation = Operation.builder().eventId(operationId).publicationStatus(Operation.PublicationStatus.PUBLISHED).allowShipProposals(true).build();
    private final OperationGroup bravo = OperationGroup.builder().id(4L).operationEventId(operationId).name("Bravo").responsibleUserId(responsibleId).build();
    private final OperationLock lock = new OperationLock(operations, events);

    private final OperationAssignmentService assignmentService = new OperationAssignmentService(operations, groups, assignments, events, participation, mock(MessageService.class), requests);
    private final OperationGroupService groupService = new OperationGroupService(operations, groups, mock(MessageService.class), assignments);
    private final OperationShipRequirementService requirementService = new OperationShipRequirementService(operations, groups, requirements, mock(MessageService.class));
    private final OperationShipService shipService = new OperationShipService(operations, hangar, proposals, mock(MessageService.class), groups, participation, requirements);

    OperationFleetAndClosureTest() {
        when(operations.findById(operationId)).thenReturn(Optional.of(operation));
        when(events.lockEndDateTime(operationId)).thenReturn(Optional.of(END));
        when(groups.findById(4L)).thenReturn(Optional.of(bravo));
        when(groups.findLockedById(4L)).thenReturn(Optional.of(bravo));
        when(groups.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(List.of(bravo));
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, memberId, 1)).thenReturn(true);
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, ownerId, 1)).thenReturn(true);
        when(hangar.existsByUserIdAndShipId(ownerId, 42L)).thenReturn(true);
        assignmentService.setOperationLock(lock);
        groupService.setOperationLock(lock);
        requirementService.setOperationLock(lock);
        shipService.setOperationLock(lock);
        at(END.minusHours(1));
    }

    @AfterEach void clearAuth() { SecurityContextHolder.clearContext(); }

    private void at(LocalDateTime now) {
        lock.setClock(Clock.fixed(now.atZone(OperationLock.ZONE).toInstant(), OperationLock.ZONE));
    }

    private void signInAs(UUID userId, String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(userId, "user", "password", List.of()), "", List.of(new SimpleGrantedAuthority(role))));
    }

    private OperationShipProposal proposal(OperationShipProposal.Status status, UUID requirementId) {
        OperationShipProposal proposal = OperationShipProposal.builder().id(UUID.randomUUID()).operationEventId(operationId).ownerUserId(ownerId).shipId(42L).requirementId(requirementId).status(status).build();
        when(proposals.findByIdAndOperationEventId(proposal.getId(), operationId)).thenReturn(Optional.of(proposal));
        return proposal;
    }

    private OperationShipRequirement requirement(int quantity) {
        OperationShipRequirement requirement = OperationShipRequirement.builder().id(UUID.randomUUID()).operationEventId(operationId).shipModelId(42L).quantity(quantity).build();
        when(requirements.findById(requirement.getId())).thenReturn(Optional.of(requirement));
        when(requirements.findLockedById(requirement.getId())).thenReturn(Optional.of(requirement));
        return requirement;
    }

    // --- Clôture -----------------------------------------------------------

    @Test void assignmentIsAcceptedOneSecondBeforeTheEndAndRefusedFromTheExactEnd() {
        signInAs(organizerId, "ROLE_OFFICIER");

        at(END.minusSeconds(1));
        assertThatCode(() -> assignmentService.assignMember(operationId, memberId, 4L)).doesNotThrowAnyException();
        verify(assignments).save(any());

        at(END);
        assertThatThrownBy(() -> assignmentService.assignMember(operationId, memberId, 4L)).isInstanceOf(OperationClosedException.class);
        at(END.plusSeconds(1));
        assertThatThrownBy(() -> assignmentService.assignMember(operationId, memberId, 4L)).isInstanceOf(OperationClosedException.class);
        verify(assignments).save(any());
    }

    @Test void aDraftIsNeverClosedAndAMovedEndAppliesImmediately() {
        signInAs(organizerId, "ROLE_OFFICIER");
        at(END.plusDays(1));
        operation.setPublicationStatus(Operation.PublicationStatus.DRAFT);
        assertThatCode(() -> lock.requireOpen(operationId)).doesNotThrowAnyException();

        operation.setPublicationStatus(Operation.PublicationStatus.PUBLISHED);
        assertThatThrownBy(() -> lock.requireOpen(operationId)).isInstanceOf(OperationClosedException.class);
        // Fin repoussée avant l'échéance par l'organisateur : c'est la nouvelle fin, relue en base, qui compte.
        when(events.lockEndDateTime(operationId)).thenReturn(Optional.of(END.plusDays(2)));
        assertThatCode(() -> lock.requireOpen(operationId)).doesNotThrowAnyException();
    }

    @Test void afterTheEndNobodyChangesAssignmentsNotEvenAnOrganizerOrADelegate() {
        at(END);
        OperationAssignment existing = OperationAssignment.builder().id(UUID.randomUUID()).operationEventId(operationId).groupId(4L).userId(memberId).build();
        when(assignments.findByOperationEventIdAndUserId(operationId, memberId)).thenReturn(Optional.of(existing));

        signInAs(organizerId, "ROLE_ADMIN");
        assertThatThrownBy(() -> assignmentService.assignMember(operationId, memberId, 4L)).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> assignmentService.removeMember(operationId, memberId)).isInstanceOf(OperationClosedException.class);

        signInAs(responsibleId, "ROLE_USER");
        assertThatThrownBy(() -> assignmentService.assignMember(operationId, memberId, 4L)).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> assignmentService.removeMember(operationId, memberId)).isInstanceOf(OperationClosedException.class);

        signInAs(memberId, "ROLE_USER");
        assertThatThrownBy(() -> assignmentService.assign(operationId, 4L)).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> assignmentService.request(operationId, 4L)).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> assignmentService.leave(operationId)).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> assignmentService.cancelRequest(operationId)).isInstanceOf(OperationClosedException.class);

        verify(assignments, never()).save(any());
        verify(assignments, never()).delete(any());
        verify(requests, never()).save(any());
    }

    @Test void aRequestOpenedBeforeTheEndCanNoLongerBeDecidedAndStaysPending() {
        OperationAssignmentRequest pending = OperationAssignmentRequest.builder().id(UUID.randomUUID()).operationEventId(operationId).groupId(4L).userId(memberId).build();
        when(requests.findById(pending.getId())).thenReturn(Optional.of(pending));
        at(END.plusMinutes(5));

        signInAs(organizerId, "ROLE_OFFICIER");
        assertThatThrownBy(() -> assignmentService.decide(pending.getId(), true)).isInstanceOf(OperationClosedException.class);
        signInAs(responsibleId, "ROLE_USER");
        assertThatThrownBy(() -> assignmentService.decide(pending.getId(), false)).isInstanceOf(OperationClosedException.class);

        assertThat(pending.getStatus()).isEqualTo(OperationAssignmentRequest.Status.PENDING);
        verify(assignments, never()).save(any());
        verify(requests, never()).save(any());
    }

    @Test void afterTheEndStructureNeedsAndShipsAreReadOnly() {
        signInAs(organizerId, "ROLE_ADMIN");
        at(END);
        OperationGroupRequest group = new OperationGroupRequest();
        group.setName("Charlie");
        group.setResponsibleUserId(memberId);
        OperationShipRequirementRequest need = new OperationShipRequirementRequest();
        need.setQuantity(1);
        OperationShipRequirement existingNeed = requirement(1);
        OperationShipProposal offered = proposal(OperationShipProposal.Status.PROPOSED, null);

        assertThatThrownBy(() -> groupService.create(operationId, group)).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> groupService.update(operationId, 4L, group)).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> groupService.delete(operationId, 4L)).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> groupService.reorder(operationId, List.of(4L))).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> requirementService.create(operationId, need)).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> requirementService.update(operationId, existingNeed.getId(), need)).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> requirementService.delete(operationId, existingNeed.getId())).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> shipService.accept(operationId, offered.getId())).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> shipService.decline(operationId, offered.getId())).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> shipService.withdraw(operationId, offered.getId())).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> shipService.markUnavailable(operationId, offered.getId())).isInstanceOf(OperationClosedException.class);
        assertThatThrownBy(() -> shipService.setPilot(operationId, offered.getId(), memberId)).isInstanceOf(OperationClosedException.class);
        signInAs(ownerId, "ROLE_USER");
        assertThatThrownBy(() -> shipService.propose(operationId, 42L, null, null)).isInstanceOf(OperationClosedException.class);

        assertThat(bravo.getResponsibleUserId()).isEqualTo(responsibleId);
        assertThat(offered.getStatus()).isEqualTo(OperationShipProposal.Status.PROPOSED);
        verify(groups, never()).save(any());
        verify(groups, never()).delete(any());
        verify(requirements, never()).save(any());
        verify(requirements, never()).delete(any());
        verify(proposals, never()).save(any());
        verify(proposals, never()).delete(any());
    }

    // --- Flotte ------------------------------------------------------------

    @Test void anAcceptedShipCoversItsNeedWithoutEverExceedingTheQuantity() {
        signInAs(organizerId, "ROLE_OFFICIER");
        OperationShipRequirement need = requirement(1);
        OperationShipProposal first = proposal(OperationShipProposal.Status.PROPOSED, need.getId());
        OperationShipProposal second = proposal(OperationShipProposal.Status.DECLINED, need.getId());

        shipService.accept(operationId, first.getId());
        assertThat(first.getStatus()).isEqualTo(OperationShipProposal.Status.ACCEPTED);
        verify(requirements).findLockedById(need.getId());

        when(proposals.countByRequirementIdAndStatusIn(need.getId(), List.of(OperationShipProposal.Status.ACCEPTED))).thenReturn(1L);
        assertThatThrownBy(() -> shipService.accept(operationId, second.getId())).isInstanceOf(IllegalStateException.class).hasMessageContaining("déjà couvert");
        assertThat(second.getStatus()).isEqualTo(OperationShipProposal.Status.DECLINED);
        // Le besoin lui-même n'est ni dupliqué ni modifié, et aucune affectation n'est créée pour le propriétaire.
        verify(requirements, never()).save(any());
        verifyNoInteractions(assignments);
    }

    @Test void aNeedCannotShrinkBelowItsAcceptedShips() {
        signInAs(organizerId, "ROLE_OFFICIER");
        requirementService.setProposalRepository(proposals);
        OperationShipRequirement need = requirement(3);
        when(proposals.countByRequirementIdAndStatusIn(need.getId(), List.of(OperationShipProposal.Status.ACCEPTED))).thenReturn(2L);
        OperationShipRequirementRequest change = new OperationShipRequirementRequest();
        change.setShipModelId(42L);

        change.setQuantity(1);
        assertThatThrownBy(() -> requirementService.update(operationId, need.getId(), change)).isInstanceOf(IllegalStateException.class).hasMessageContaining("2 vaisseaux sont déjà acceptés");
        assertThat(need.getQuantity()).isEqualTo(3);
        verify(requirements, never()).save(any());

        when(requirements.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        change.setQuantity(2);
        requirementService.update(operationId, need.getId(), change);
        assertThat(need.getQuantity()).isEqualTo(2);
        verify(requirements, org.mockito.Mockito.times(2)).findLockedById(need.getId());

        // Supprimer le besoin ne contourne pas la règle.
        assertThatThrownBy(() -> requirementService.delete(operationId, need.getId())).isInstanceOf(IllegalStateException.class).hasMessageContaining("acceptés répondent");
        verify(requirements, never()).delete(any());
    }

    @Test void aShipThatLeftTheHangarOrWhoseOwnerIsNoLongerPresentCannotBeAccepted() {
        signInAs(organizerId, "ROLE_OFFICIER");
        OperationShipProposal offered = proposal(OperationShipProposal.Status.PROPOSED, null);

        when(hangar.existsByUserIdAndShipId(ownerId, 42L)).thenReturn(false);
        assertThatThrownBy(() -> shipService.accept(operationId, offered.getId())).isInstanceOf(IllegalStateException.class).hasMessageContaining("hangar");

        when(hangar.existsByUserIdAndShipId(ownerId, 42L)).thenReturn(true);
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, ownerId, 1)).thenReturn(false);
        assertThatThrownBy(() -> shipService.accept(operationId, offered.getId())).isInstanceOf(IllegalStateException.class).hasMessageContaining("Présent");
        assertThat(offered.getStatus()).isEqualTo(OperationShipProposal.Status.PROPOSED);
    }

    @Test void onlyOnesOwnHangarWhilePresentAndOnlyOncePerShip() {
        signInAs(memberId, "ROLE_USER");
        // Le vaisseau 42 est dans le hangar d'un autre membre, pas dans le sien.
        assertThatThrownBy(() -> shipService.propose(operationId, 42L, null, null)).isInstanceOf(ResourceNotFoundException.class).hasMessageContaining("hangar");

        signInAs(ownerId, "ROLE_USER");
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, ownerId, 1)).thenReturn(false);
        assertThatThrownBy(() -> shipService.propose(operationId, 42L, null, null)).isInstanceOf(IllegalStateException.class).hasMessageContaining("Présent");

        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, ownerId, 1)).thenReturn(true);
        when(proposals.existsByOperationEventIdAndOwnerUserIdAndShipId(operationId, ownerId, 42L)).thenReturn(true);
        assertThatThrownBy(() -> shipService.propose(operationId, 42L, null, null)).isInstanceOf(IllegalStateException.class).hasMessageContaining("déjà proposé");

        operation.setPublicationStatus(Operation.PublicationStatus.DRAFT);
        assertThatThrownBy(() -> shipService.propose(operationId, 42L, null, null)).isInstanceOf(ResourceNotFoundException.class);
        verify(proposals, never()).save(any());
    }

    @Test void withdrawingAShipIsForItsOwnerOrAnOrganizerAndNeverTouchesAssignments() {
        OperationShipProposal offered = proposal(OperationShipProposal.Status.ACCEPTED, null);

        signInAs(memberId, "ROLE_USER");
        assertThatThrownBy(() -> shipService.withdraw(operationId, offered.getId())).isInstanceOf(AccessDeniedException.class);
        verify(proposals, never()).delete(any());

        // Refusée, elle reste visible : son propriétaire ne peut pas la retirer pour la proposer à nouveau.
        offered.setStatus(OperationShipProposal.Status.DECLINED);
        signInAs(ownerId, "ROLE_USER");
        assertThatThrownBy(() -> shipService.withdraw(operationId, offered.getId())).isInstanceOf(IllegalStateException.class).hasMessageContaining("refusée");
        verify(proposals, never()).delete(any());

        signInAs(organizerId, "ROLE_OFFICIER");
        shipService.withdraw(operationId, offered.getId());
        verify(proposals).delete(offered);
        verifyNoInteractions(assignments);
    }
}
