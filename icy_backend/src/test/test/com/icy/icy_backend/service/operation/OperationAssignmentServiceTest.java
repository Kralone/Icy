package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.entity.event.OperationAssignment;
import com.icy.icy_backend.db.entity.event.OperationGroup;
import com.icy.icy_backend.db.entity.event.Event;
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

class OperationAssignmentServiceTest {
    @AfterEach void clearAuth() { SecurityContextHolder.clearContext(); }

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
}
