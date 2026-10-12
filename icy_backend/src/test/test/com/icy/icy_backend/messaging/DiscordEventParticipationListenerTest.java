package com.icy.icy_backend.messaging;

import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.EventParticipation;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRequestRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class DiscordEventParticipationListenerTest {
    @Test
    void discordParticipationIsPersistedAndPublishesEventRefresh() {
        EventRepository events = mock(EventRepository.class);
        UserRepository users = mock(UserRepository.class);
        EventParticipationRepository participations = mock(EventParticipationRepository.class);
        EventPublisher publisher = mock(EventPublisher.class);
        OperationAssignmentRepository assignments = mock(OperationAssignmentRepository.class);
        OperationAssignmentRequestRepository requests = mock(OperationAssignmentRequestRepository.class);
        DiscordEventParticipationListener listener = new DiscordEventParticipationListener(
                events, users, participations, publisher, assignments, requests);

        UUID eventId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        User user = new User();
        user.setId(userId);
        user.setDiscordId("discord-1");
        when(events.findById(eventId)).thenReturn(Optional.of(event));
        when(users.findByDiscordId("discord-1")).thenReturn(Optional.of(user));
        when(participations.findByEventAndUser(event, user)).thenReturn(Optional.empty());

        listener.handleParticipation(Map.of(
                "eventId", eventId.toString(), "userId", "discord-1",
                "username", "pilot", "status", 1));

        verify(participations).save(any(EventParticipation.class));
        verify(publisher).publishEventUpdated(event);
        verify(assignments, never()).deleteByOperationEventIdAndUserId(any(), any());
    }

    @Test
    void discordAbsenceRemovesOperationAssignmentAndPendingRequest() {
        EventRepository events = mock(EventRepository.class);
        UserRepository users = mock(UserRepository.class);
        EventParticipationRepository participations = mock(EventParticipationRepository.class);
        EventPublisher publisher = mock(EventPublisher.class);
        OperationAssignmentRepository assignments = mock(OperationAssignmentRepository.class);
        OperationAssignmentRequestRepository requests = mock(OperationAssignmentRequestRepository.class);
        DiscordEventParticipationListener listener = new DiscordEventParticipationListener(
                events, users, participations, publisher, assignments, requests);

        UUID eventId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        User user = new User();
        user.setId(userId);
        when(events.findById(eventId)).thenReturn(Optional.of(event));
        when(users.findByDiscordId("discord-1")).thenReturn(Optional.of(user));
        when(participations.findByEventAndUser(event, user)).thenReturn(Optional.empty());

        listener.handleParticipation(Map.of(
                "eventId", eventId.toString(), "userId", "discord-1",
                "username", "pilot", "status", -1));

        verify(assignments).deleteByOperationEventIdAndUserId(eventId, userId);
        verify(requests).deleteByOperationEventIdAndUserIdAndStatus(eq(eventId), eq(userId),
                eq(com.icy.icy_backend.db.entity.event.OperationAssignmentRequest.Status.PENDING));
        verify(publisher).publishEventUpdated(event);
    }
}
