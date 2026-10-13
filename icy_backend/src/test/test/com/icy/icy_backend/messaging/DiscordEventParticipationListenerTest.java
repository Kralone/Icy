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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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

        TransactionSynchronizationManager.initSynchronization();
        try {
            listener.handleParticipation(Map.of(
                    "eventId", eventId.toString(), "userId", "discord-1",
                    "username", "pilot", "status", 1));

            verify(publisher, never()).publishEventUpdated(any());
            TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }

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

    private record Fixture(DiscordEventParticipationListener listener, EventRepository events, UserRepository users,
                           EventParticipationRepository participations, EventPublisher publisher) {}

    private static Fixture fixture() {
        EventRepository events = mock(EventRepository.class);
        UserRepository users = mock(UserRepository.class);
        EventParticipationRepository participations = mock(EventParticipationRepository.class);
        EventPublisher publisher = mock(EventPublisher.class);
        DiscordEventParticipationListener listener = new DiscordEventParticipationListener(events, users, participations, publisher,
                mock(OperationAssignmentRepository.class), mock(OperationAssignmentRequestRepository.class));
        return new Fixture(listener, events, users, participations, publisher);
    }

    @Test
    void anAcceptedAnswerIsReportedAsRecorded() {
        Fixture f = fixture();
        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        User user = new User();
        user.setId(UUID.randomUUID());
        when(f.events().findById(eventId)).thenReturn(Optional.of(event));
        when(f.users().findByDiscordId("discord-1")).thenReturn(Optional.of(user));
        when(f.participations().findByEventAndUser(event, user)).thenReturn(Optional.empty());

        org.assertj.core.api.Assertions.assertThat(f.listener().record(eventId, "discord-1", "pilot", 0))
                .isEqualTo(DiscordEventParticipationListener.Outcome.RECORDED);
        verify(f.participations()).save(any(EventParticipation.class));
    }

    @Test
    void anUnknownOrInactiveDiscordAccountIsNeverReportedAsRecorded() {
        Fixture f = fixture();
        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        when(f.events().findById(eventId)).thenReturn(Optional.of(event));
        // Le dépôt ne rend que les comptes actifs : inconnu et inactif se présentent de la même façon.
        when(f.users().findByDiscordId("discord-9")).thenReturn(Optional.empty());

        org.assertj.core.api.Assertions.assertThat(f.listener().record(eventId, "discord-9", "stranger", 1))
                .isEqualTo(DiscordEventParticipationListener.Outcome.UNKNOWN_USER);
        verify(f.participations(), never()).save(any());
        verifyNoInteractions(f.publisher());
    }

    @Test
    void aDeletedEventAndAnInvalidAnswerAreNotRecorded() {
        Fixture f = fixture();
        UUID gone = UUID.randomUUID();
        when(f.events().findById(gone)).thenReturn(Optional.empty());

        org.assertj.core.api.Assertions.assertThat(f.listener().record(gone, "discord-1", "pilot", 1))
                .isEqualTo(DiscordEventParticipationListener.Outcome.EVENT_NOT_FOUND);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> f.listener().record(gone, "discord-1", "pilot", 7))
                .isInstanceOf(IllegalArgumentException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> f.listener().record(gone, " ", "pilot", 1))
                .isInstanceOf(IllegalArgumentException.class);
        verify(f.participations(), never()).save(any());
    }

    @Test
    void theBotEndpointReturnsTheRealOutcome() {
        DiscordEventParticipationListener listener = mock(DiscordEventParticipationListener.class);
        var controller = new com.icy.icy_backend.controller.event.BotEventParticipationController(listener);
        UUID eventId = UUID.randomUUID();
        when(listener.record(eventId, "discord-9", "stranger", 1)).thenReturn(DiscordEventParticipationListener.Outcome.UNKNOWN_USER);

        var response = controller.record(new com.icy.icy_backend.controller.event.BotEventParticipationController.Request(eventId, "discord-9", "stranger", 1));

        org.assertj.core.api.Assertions.assertThat(response.getStatusCode().value()).isEqualTo(200);
        org.assertj.core.api.Assertions.assertThat(response.getBody()).containsEntry("outcome", "UNKNOWN_USER");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> controller.record(new com.icy.icy_backend.controller.event.BotEventParticipationController.Request(eventId, "discord-9", "stranger", null)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
