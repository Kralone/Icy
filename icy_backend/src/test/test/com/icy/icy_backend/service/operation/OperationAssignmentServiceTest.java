package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.entity.event.OperationAssignment;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.OperationAssignmentRequest;
import com.icy.icy_backend.db.repository.event.*;
import com.icy.icy_backend.db.repository.user.UserShipRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import com.icy.icy_backend.security.UserAuthDetails;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OperationAssignmentServiceTest {
    @AfterEach void clearAuth() { SecurityContextHolder.clearContext(); }

    @Test void groupsWithoutTheirOwnModeFollowTheOperationDefault() {
        UUID operationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        OperationRepository operations = mock(OperationRepository.class);
        OperationGroupRepository groups = mock(OperationGroupRepository.class);
        OperationAssignmentRepository assignments = mock(OperationAssignmentRepository.class);
        EventParticipationRepository participation = mock(EventParticipationRepository.class);
        EventRepository events = mock(EventRepository.class);
        Operation operation = Operation.builder().eventId(operationId).publicationStatus(Operation.PublicationStatus.PUBLISHED)
                .defaultAssignmentMode(OperationGroup.AssignmentMode.MANAGED).build();
        OperationGroup leaf = OperationGroup.builder().id(2L).operationEventId(operationId).build();
        when(operations.findById(operationId)).thenReturn(Optional.of(operation));
        when(events.findById(operationId)).thenReturn(Optional.of(Event.builder().id(operationId).build()));
        when(groups.findById(2L)).thenReturn(Optional.of(leaf));
        when(groups.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(List.of(leaf));
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, userId, 1)).thenReturn(true);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(userId, "user", "password", List.of()), "", List.of(new SimpleGrantedAuthority("ROLE_USER"))));

        var service = new OperationAssignmentService(operations, groups, assignments, events, participation, mock(MessageService.class), mock(OperationAssignmentRequestRepository.class));

        assertThatThrownBy(() -> service.assign(operationId, 2L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("géré par les organisateurs");
        verify(assignments, never()).save(any(OperationAssignment.class));
    }

    @Test void locksLeafAndAncestorsInStableOrderBeforeCapacityRead() {
        UUID operationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        OperationRepository operations = mock(OperationRepository.class);
        OperationGroupRepository groups = mock(OperationGroupRepository.class);
        OperationAssignmentRepository assignments = mock(OperationAssignmentRepository.class);
        EventParticipationRepository participation = mock(EventParticipationRepository.class);
        Operation operation = Operation.builder().eventId(operationId).publicationStatus(Operation.PublicationStatus.PUBLISHED).build();
        OperationGroup parent = OperationGroup.builder().id(1L).operationEventId(operationId).capacity(2).build();
        OperationGroup leaf = OperationGroup.builder().id(2L).operationEventId(operationId).parentId(1L).assignmentMode(OperationGroup.AssignmentMode.FREE).build();
        when(operations.findById(operationId)).thenReturn(Optional.of(operation));
        EventRepository events = mock(EventRepository.class);
        when(events.findById(operationId)).thenReturn(Optional.of(Event.builder().id(operationId).build()));
        when(groups.findById(2L)).thenReturn(Optional.of(leaf));
        when(groups.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(List.of(parent, leaf));
        when(groups.findLockedById(1L)).thenReturn(Optional.of(parent));
        when(groups.findLockedById(2L)).thenReturn(Optional.of(leaf));
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, userId, 1)).thenReturn(true);
        when(assignments.findByOperationEventId(operationId)).thenReturn(List.of());
        when(assignments.findByOperationEventIdAndUserId(operationId, userId)).thenReturn(Optional.empty());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(userId, "user", "password", List.of()), "", List.of(new SimpleGrantedAuthority("ROLE_USER"))));

        var service = new OperationAssignmentService(operations, groups, assignments, events, participation, mock(MessageService.class), mock(OperationAssignmentRequestRepository.class));
        service.assign(operationId, 2L);

        var inOrder = inOrder(groups);
        inOrder.verify(groups).findLockedById(1L);
        inOrder.verify(groups).findLockedById(2L);
        verify(assignments).save(any(OperationAssignment.class));
        assertThat(operation.isAllowShipProposals()).isFalse();
    }

    @Test
    void delegatedParentCanRefuseChildRequest() {
        UUID operationId = UUID.randomUUID();
        UUID responsibleId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        var operations = mock(OperationRepository.class);
        var groups = mock(OperationGroupRepository.class);
        var assignments = mock(OperationAssignmentRepository.class);
        var participation = mock(EventParticipationRepository.class);
        var events = mock(EventRepository.class);
        var requests = mock(OperationAssignmentRequestRepository.class);
        var request = OperationAssignmentRequest.builder().id(requestId).operationEventId(operationId).groupId(2L).userId(UUID.randomUUID()).build();
        var parent = OperationGroup.builder().id(1L).operationEventId(operationId).responsibleUserId(responsibleId).build();
        var child = OperationGroup.builder().id(2L).operationEventId(operationId).parentId(1L).build();
        when(requests.findById(requestId)).thenReturn(Optional.of(request));
        when(groups.findById(2L)).thenReturn(Optional.of(child));
        when(groups.findById(1L)).thenReturn(Optional.of(parent));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(responsibleId, "responsible", "password", List.of()), "", List.of(new SimpleGrantedAuthority("ROLE_USER"))));

        var service = new OperationAssignmentService(operations, groups, assignments, events, participation, mock(MessageService.class), requests);
        service.decide(requestId, false);

        assertThat(request.getStatus()).isEqualTo(OperationAssignmentRequest.Status.REFUSED);
        verify(requests).save(request);
    }

    @Test
    void delegatedParentCannotDecideSiblingRequest() {
        UUID operationId = UUID.randomUUID();
        UUID responsibleId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        var operations = mock(OperationRepository.class);
        var groups = mock(OperationGroupRepository.class);
        var requests = mock(OperationAssignmentRequestRepository.class);
        var request = OperationAssignmentRequest.builder().id(requestId).operationEventId(operationId).groupId(3L).userId(UUID.randomUUID()).build();
        var siblingParent = OperationGroup.builder().id(4L).operationEventId(operationId).responsibleUserId(UUID.randomUUID()).build();
        var sibling = OperationGroup.builder().id(3L).operationEventId(operationId).parentId(4L).build();
        when(requests.findById(requestId)).thenReturn(Optional.of(request));
        when(groups.findById(3L)).thenReturn(Optional.of(sibling));
        when(groups.findById(4L)).thenReturn(Optional.of(siblingParent));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(responsibleId, "responsible", "password", List.of()), "", List.of(new SimpleGrantedAuthority("ROLE_USER"))));

        var service = new OperationAssignmentService(operations, groups, mock(OperationAssignmentRepository.class), mock(EventRepository.class), mock(EventParticipationRepository.class), mock(MessageService.class), requests);
        assertThatThrownBy(() -> service.decide(requestId, false)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(requests, never()).save(any());
    }

    @Test
    void refusesAssigningToParentWithChildren() {
        UUID operationId = UUID.randomUUID();
        var operations = mock(OperationRepository.class);
        var groups = mock(OperationGroupRepository.class);
        var operation = Operation.builder().eventId(operationId).publicationStatus(Operation.PublicationStatus.PUBLISHED).build();
        var parent = OperationGroup.builder().id(1L).operationEventId(operationId).build();
        when(operations.findById(operationId)).thenReturn(Optional.of(operation));
        when(groups.findById(1L)).thenReturn(Optional.of(parent));
        when(groups.existsByParentId(1L)).thenReturn(true);

        var service = new OperationAssignmentService(operations, groups, mock(OperationAssignmentRepository.class),
                mock(EventRepository.class), mock(EventParticipationRepository.class), mock(MessageService.class),
                mock(OperationAssignmentRequestRepository.class));

        assertThatThrownBy(() -> service.assign(operationId, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Affectation possible uniquement sur une feuille");
    }

    @Test
    void refusesDirectAssignmentOnManagedLeaf() {
        UUID operationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var operations = mock(OperationRepository.class);
        var groups = mock(OperationGroupRepository.class);
        var participation = mock(EventParticipationRepository.class);
        var leaf = OperationGroup.builder().id(2L).operationEventId(operationId)
                .assignmentMode(OperationGroup.AssignmentMode.MANAGED).build();
        when(operations.findById(operationId)).thenReturn(Optional.of(Operation.builder().eventId(operationId)
                .publicationStatus(Operation.PublicationStatus.PUBLISHED).build()));
        when(groups.findById(2L)).thenReturn(Optional.of(leaf));
        when(groups.existsByParentId(2L)).thenReturn(false);
        when(groups.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(List.of(leaf));
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, userId, 1)).thenReturn(true);
        var events = mock(EventRepository.class);
        when(events.findById(operationId)).thenReturn(Optional.of(Event.builder().id(operationId).build()));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(userId, "user", "password", List.of()), "", List.of(new SimpleGrantedAuthority("ROLE_USER"))));

        var service = new OperationAssignmentService(operations, groups, mock(OperationAssignmentRepository.class),
                events, participation, mock(MessageService.class), mock(OperationAssignmentRequestRepository.class));

        assertThatThrownBy(() -> service.assign(operationId, 2L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Groupe géré par les organisateurs");
    }

    @Test
    void refusesDirectAssignmentOnValidationLeaf() {
        UUID operationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var operations = mock(OperationRepository.class);
        var groups = mock(OperationGroupRepository.class);
        var participation = mock(EventParticipationRepository.class);
        var leaf = OperationGroup.builder().id(2L).operationEventId(operationId)
                .assignmentMode(OperationGroup.AssignmentMode.VALIDATION).build();
        when(operations.findById(operationId)).thenReturn(Optional.of(Operation.builder().eventId(operationId)
                .publicationStatus(Operation.PublicationStatus.PUBLISHED).build()));
        when(groups.findById(2L)).thenReturn(Optional.of(leaf));
        when(groups.existsByParentId(2L)).thenReturn(false);
        when(groups.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(List.of(leaf));
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, userId, 1)).thenReturn(true);
        var events = mock(EventRepository.class);
        when(events.findById(operationId)).thenReturn(Optional.of(Event.builder().id(operationId).build()));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(userId, "user", "password", List.of()), "", List.of(new SimpleGrantedAuthority("ROLE_USER"))));

        var service = new OperationAssignmentService(operations, groups, mock(OperationAssignmentRepository.class),
                events, participation, mock(MessageService.class), mock(OperationAssignmentRequestRepository.class));

        assertThatThrownBy(() -> service.assign(operationId, 2L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Une demande de validation sera disponible dans l’éditeur");
    }

    @Test
    void reusesExistingUserAssignmentWhenChangingLeaf() {
        UUID operationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var operations = mock(OperationRepository.class);
        var groups = mock(OperationGroupRepository.class);
        var assignments = mock(OperationAssignmentRepository.class);
        var participation = mock(EventParticipationRepository.class);
        var events = mock(EventRepository.class);
        var leaf = OperationGroup.builder().id(2L).operationEventId(operationId)
                .assignmentMode(OperationGroup.AssignmentMode.FREE).build();
        var current = OperationAssignment.builder().id(UUID.randomUUID()).operationEventId(operationId)
                .groupId(1L).userId(userId).status(OperationAssignment.Status.CONFIRMED).build();
        when(operations.findById(operationId)).thenReturn(Optional.of(Operation.builder().eventId(operationId)
                .publicationStatus(Operation.PublicationStatus.PUBLISHED).build()));
        when(groups.findById(2L)).thenReturn(Optional.of(leaf));
        when(groups.existsByParentId(2L)).thenReturn(false);
        when(groups.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(List.of(leaf));
        when(groups.findLockedById(2L)).thenReturn(Optional.of(leaf));
        when(events.findById(operationId)).thenReturn(Optional.of(Event.builder().id(operationId).build()));
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, userId, 1)).thenReturn(true);
        when(assignments.findByOperationEventId(operationId)).thenReturn(List.of(current));
        when(assignments.findByOperationEventIdAndUserId(operationId, userId)).thenReturn(Optional.of(current));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(userId, "user", "password", List.of()), "", List.of(new SimpleGrantedAuthority("ROLE_USER"))));

        var service = new OperationAssignmentService(operations, groups, assignments, events, participation,
                mock(MessageService.class), mock(OperationAssignmentRequestRepository.class));
        service.assign(operationId, 2L);

        assertThat(current.getGroupId()).isEqualTo(2L);
        verify(assignments).save(current);
    }

    @Test
    void refusesSecondPendingRequestForSameUserAndOperation() {
        UUID operationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var operations = mock(OperationRepository.class);
        var groups = mock(OperationGroupRepository.class);
        var participation = mock(EventParticipationRepository.class);
        var requests = mock(OperationAssignmentRequestRepository.class);
        var leaf = OperationGroup.builder().id(2L).operationEventId(operationId)
                .assignmentMode(OperationGroup.AssignmentMode.VALIDATION).build();
        when(operations.findById(operationId)).thenReturn(Optional.of(Operation.builder().eventId(operationId)
                .publicationStatus(Operation.PublicationStatus.PUBLISHED).build()));
        when(groups.findLockedById(2L)).thenReturn(Optional.of(leaf));
        when(groups.existsByParentId(2L)).thenReturn(false);
        when(groups.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(List.of(leaf));
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, userId, 1)).thenReturn(true);
        when(requests.findFirstByOperationEventIdAndUserIdAndStatusOrderByCreatedAtDesc(
                operationId, userId, OperationAssignmentRequest.Status.PENDING))
                .thenReturn(Optional.of(OperationAssignmentRequest.builder().operationEventId(operationId).userId(userId).build()));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(userId, "user", "password", List.of()), "", List.of(new SimpleGrantedAuthority("ROLE_USER"))));

        var service = new OperationAssignmentService(operations, groups, mock(OperationAssignmentRepository.class),
                mock(EventRepository.class), participation, mock(MessageService.class), requests);

        assertThatThrownBy(() -> service.request(operationId, 2L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Demande déjà en attente");
        verify(requests, never()).save(any());
    }

    @Test
    void creatingTransferRequestLeavesConfirmedAssignmentUntouched() {
        UUID operationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        var operations = mock(OperationRepository.class);
        var groups = mock(OperationGroupRepository.class);
        var participation = mock(EventParticipationRepository.class);
        var requests = mock(OperationAssignmentRequestRepository.class);
        var assignments = mock(OperationAssignmentRepository.class);
        var leaf = OperationGroup.builder().id(2L).operationEventId(operationId)
                .assignmentMode(OperationGroup.AssignmentMode.VALIDATION).build();
        when(operations.findById(operationId)).thenReturn(Optional.of(Operation.builder().eventId(operationId)
                .publicationStatus(Operation.PublicationStatus.PUBLISHED).build()));
        when(groups.findLockedById(2L)).thenReturn(Optional.of(leaf));
        when(groups.existsByParentId(2L)).thenReturn(false);
        when(groups.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(List.of(leaf));
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, userId, 1)).thenReturn(true);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(userId, "user", "password", List.of()), "", List.of(new SimpleGrantedAuthority("ROLE_USER"))));

        var service = new OperationAssignmentService(operations, groups, assignments, mock(EventRepository.class),
                participation, mock(MessageService.class), requests);
        service.request(operationId, 2L);

        verify(requests).save(any(OperationAssignmentRequest.class));
        verifyNoInteractions(assignments);
    }

    @Test
    void approvingTransferMovesExistingAssignmentAndMarksRequestApproved() {
        UUID operationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        var operations = mock(OperationRepository.class);
        var groups = mock(OperationGroupRepository.class);
        var assignments = mock(OperationAssignmentRepository.class);
        var requests = mock(OperationAssignmentRequestRepository.class);
        var request = OperationAssignmentRequest.builder().id(requestId).operationEventId(operationId)
                .groupId(2L).userId(userId).build();
        var target = OperationGroup.builder().id(2L).operationEventId(operationId)
                .assignmentMode(OperationGroup.AssignmentMode.VALIDATION).build();
        var current = OperationAssignment.builder().id(UUID.randomUUID()).operationEventId(operationId)
                .groupId(1L).userId(userId).status(OperationAssignment.Status.CONFIRMED).build();
        when(requests.findById(requestId)).thenReturn(Optional.of(request));
        when(groups.findById(2L)).thenReturn(Optional.of(target));
        when(operations.findById(operationId)).thenReturn(Optional.of(Operation.builder().eventId(operationId)
                .publicationStatus(Operation.PublicationStatus.PUBLISHED).build()));
        when(groups.findByOperationEventIdOrderBySortOrderAscIdAsc(operationId)).thenReturn(List.of(target));
        when(groups.findLockedById(2L)).thenReturn(Optional.of(target));
        when(assignments.findByOperationEventId(operationId)).thenReturn(List.of(current));
        when(assignments.findByOperationEventIdAndUserId(operationId, userId)).thenReturn(Optional.of(current));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new UserAuthDetails(UUID.randomUUID(), "admin", "password", List.of()), "", List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));

        var participation = mock(EventParticipationRepository.class);
        when(participation.existsByEvent_IdAndUser_IdAndStatus(operationId, userId, 1)).thenReturn(true);
        var service = new OperationAssignmentService(operations, groups, assignments, mock(EventRepository.class),
                participation, mock(MessageService.class), requests);
        service.decide(requestId, true);

        assertThat(current.getGroupId()).isEqualTo(2L);
        assertThat(request.getStatus()).isEqualTo(OperationAssignmentRequest.Status.APPROVED);
        verify(assignments).save(current);
        verify(requests).save(request);
    }
}
