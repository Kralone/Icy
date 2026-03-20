package com.icy.icy_backend.service.event;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.EventResponseDTO;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.EventParticipation;
import com.icy.icy_backend.db.entity.event.EventType;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.EventTypeRepository;
import com.icy.icy_backend.messaging.EventPublisher;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.auth.AuthService;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.notification.NotificationPushService;
import com.icy.icy_backend.service.user.UserService;
import com.icy.icy_backend.websocket.EventWebSocketService;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EventServiceTest {

    @Test
    void createEventPublishesAndBroadcasts() {
        EventRepository eventRepository = Mockito.mock(EventRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        EventWebSocketService eventWebSocketService = Mockito.mock(EventWebSocketService.class);
        EventTypeRepository eventTypeRepository = Mockito.mock(EventTypeRepository.class);
        EventParticipationRepository participationRepository = Mockito.mock(EventParticipationRepository.class);
        UserService userService = Mockito.mock(UserService.class);
        AuthService authService = Mockito.mock(AuthService.class);
        EventPublisher eventPublisher = Mockito.mock(EventPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        EventService service = new EventService(eventRepository, messageService, eventWebSocketService,
                eventTypeRepository, participationRepository, userService, authService, eventPublisher, notificationPushService);

        UUID userId = UUID.randomUUID();
        User creator = new User();
        creator.setId(userId);
        creator.setUsername("alice");
        when(userService.findUserById(userId)).thenReturn(creator);

        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        ResponseEntity<MessageResponse<EventResponseDTO>> response = okResponse(new EventResponseDTO(new Event()));
        Mockito.doReturn(response).when(messageService).buildResponse(eq("event.created"), any());

        try (MockedStatic<AuthUtils> mockedAuth = Mockito.mockStatic(AuthUtils.class)) {
            mockedAuth.when(AuthUtils::getCurrentUserId).thenReturn(userId);

            ResponseEntity<MessageResponse<EventResponseDTO>> actual = service.createEvent(
                    "Type", "Title", "Desc",
                    LocalDateTime.now(), LocalDateTime.now().plusHours(1)
            );

            assertThat(actual).isEqualTo(response);
            verify(eventWebSocketService).sendEventUpdate(any(Event.class), eq("ADD"));
            verify(eventPublisher).publishEventCreated(any(Event.class));
            verify(notificationPushService).sendBroadcast(any(), any(), any(), any());
        }
    }

    @Test
    void updateEventDeletesParticipationsWhenDateChanges() {
        EventRepository eventRepository = Mockito.mock(EventRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        EventWebSocketService eventWebSocketService = Mockito.mock(EventWebSocketService.class);
        EventTypeRepository eventTypeRepository = Mockito.mock(EventTypeRepository.class);
        EventParticipationRepository participationRepository = Mockito.mock(EventParticipationRepository.class);
        UserService userService = Mockito.mock(UserService.class);
        AuthService authService = Mockito.mock(AuthService.class);
        EventPublisher eventPublisher = Mockito.mock(EventPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        EventService service = new EventService(eventRepository, messageService, eventWebSocketService,
                eventTypeRepository, participationRepository, userService, authService, eventPublisher, notificationPushService);

        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setStartDateTime(LocalDateTime.now().minusDays(1));
        event.setEndDateTime(LocalDateTime.now().minusDays(1).plusHours(1));
        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(participationRepository.findAllByEvent(event)).thenReturn(Optional.of(List.of()));

        ResponseEntity<MessageResponse<EventResponseDTO>> response = okResponse(new EventResponseDTO(event));
        Mockito.doReturn(response).when(messageService).buildResponse(eq("event.updated"), any());

        ResponseEntity<MessageResponse<EventResponseDTO>> actual = service.updateEvent(
                event.getId(),
                "Type",
                "Title",
                "Desc",
                LocalDateTime.now(),
                LocalDateTime.now().plusHours(1),
                false
        );

        assertThat(actual).isEqualTo(response);
        verify(participationRepository).deleteAllByEvent(event);
        verify(eventPublisher).publishEventUpdated(event);
        verify(notificationPushService).sendBroadcast(any(), any(), any(), any());
    }

    @Test
    void updateEventPublishesEndedWhenMarkedFinished() {
        EventRepository eventRepository = Mockito.mock(EventRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        EventWebSocketService eventWebSocketService = Mockito.mock(EventWebSocketService.class);
        EventTypeRepository eventTypeRepository = Mockito.mock(EventTypeRepository.class);
        EventParticipationRepository participationRepository = Mockito.mock(EventParticipationRepository.class);
        UserService userService = Mockito.mock(UserService.class);
        AuthService authService = Mockito.mock(AuthService.class);
        EventPublisher eventPublisher = Mockito.mock(EventPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        EventService service = new EventService(eventRepository, messageService, eventWebSocketService,
                eventTypeRepository, participationRepository, userService, authService, eventPublisher, notificationPushService);

        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setStartDateTime(LocalDateTime.now().plusHours(1));
        event.setEndDateTime(LocalDateTime.now().plusHours(2));
        event.setFinished(false);

        when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ResponseEntity<MessageResponse<EventResponseDTO>> response = okResponse(new EventResponseDTO(event));
        Mockito.doReturn(response).when(messageService).buildResponse(eq("event.updated"), any());

        ResponseEntity<MessageResponse<EventResponseDTO>> actual = service.updateEvent(
                event.getId(),
                "Type",
                "Title",
                "Desc",
                event.getStartDateTime(),
                event.getEndDateTime(),
                true
        );

        assertThat(actual).isEqualTo(response);
        verify(eventPublisher).publishEventUpdated(event);
        verify(eventPublisher).publishEventEnded(event);
    }

    @Test
    void deleteEventRemovesParticipationsBeforeDeletingEvent() {
        EventRepository eventRepository = Mockito.mock(EventRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        EventWebSocketService eventWebSocketService = Mockito.mock(EventWebSocketService.class);
        EventTypeRepository eventTypeRepository = Mockito.mock(EventTypeRepository.class);
        EventParticipationRepository participationRepository = Mockito.mock(EventParticipationRepository.class);
        UserService userService = Mockito.mock(UserService.class);
        AuthService authService = Mockito.mock(AuthService.class);
        EventPublisher eventPublisher = Mockito.mock(EventPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        EventService service = new EventService(eventRepository, messageService, eventWebSocketService,
                eventTypeRepository, participationRepository, userService, authService, eventPublisher, notificationPushService);

        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        event.setTitle("Raid");
        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));

        User participantUser = new User();
        participantUser.setId(UUID.randomUUID());
        EventParticipation participation = new EventParticipation();
        participation.setEvent(event);
        participation.setUser(participantUser);
        when(participationRepository.findAllByEvent(event)).thenReturn(Optional.of(List.of(participation)));

        ResponseEntity<MessageResponse<Void>> response = okResponse(null);
        Mockito.doReturn(response).when(messageService).buildResponse(eq("event.deleted"), eq(null));

        ResponseEntity<MessageResponse<Void>> actual = service.deleteEvent(eventId);

        assertThat(actual).isEqualTo(response);
        InOrder inOrder = Mockito.inOrder(participationRepository, eventRepository);
        inOrder.verify(participationRepository).deleteAllByEvent(event);
        inOrder.verify(eventRepository).delete(event);
        verify(eventWebSocketService).sendEventUpdate(event, "DELETE");
        verify(eventPublisher).publishEventDeleted(event);
        verify(notificationPushService).sendBroadcast(any(), any(), any(), any());
        verify(notificationPushService).sendToUsers(eq(List.of(participantUser.getId())), any(), any(), any(), any());
    }

    @Test
    void markExpiredEventsAsFinishedHandlesAllExpiredEvents() {
        EventRepository eventRepository = Mockito.mock(EventRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        EventWebSocketService eventWebSocketService = Mockito.mock(EventWebSocketService.class);
        EventTypeRepository eventTypeRepository = Mockito.mock(EventTypeRepository.class);
        EventParticipationRepository participationRepository = Mockito.mock(EventParticipationRepository.class);
        UserService userService = Mockito.mock(UserService.class);
        AuthService authService = Mockito.mock(AuthService.class);
        EventPublisher eventPublisher = Mockito.mock(EventPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        EventService service = new EventService(eventRepository, messageService, eventWebSocketService,
                eventTypeRepository, participationRepository, userService, authService, eventPublisher, notificationPushService);

        Event oldEvent = new Event();
        oldEvent.setId(UUID.randomUUID());
        oldEvent.setFinished(false);
        oldEvent.setEndDateTime(LocalDateTime.now().minusDays(2));

        when(eventRepository.findByEndDateTimeBeforeAndFinishedFalse(any(LocalDateTime.class)))
                .thenReturn(List.of(oldEvent));
        when(eventRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.markExpiredEventsAsFinished();

        assertThat(oldEvent.isFinished()).isTrue();
        verify(eventWebSocketService).sendEventUpdate(oldEvent, "UPDATE");
        verify(eventPublisher).publishEventEnded(oldEvent);
    }

    @Test
    void setParticipationCreatesOrUpdates() {
        EventRepository eventRepository = Mockito.mock(EventRepository.class);
        MessageService messageService = Mockito.mock(MessageService.class);
        EventWebSocketService eventWebSocketService = Mockito.mock(EventWebSocketService.class);
        EventTypeRepository eventTypeRepository = Mockito.mock(EventTypeRepository.class);
        EventParticipationRepository participationRepository = Mockito.mock(EventParticipationRepository.class);
        UserService userService = Mockito.mock(UserService.class);
        AuthService authService = Mockito.mock(AuthService.class);
        EventPublisher eventPublisher = Mockito.mock(EventPublisher.class);
        NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);

        EventService service = new EventService(eventRepository, messageService, eventWebSocketService,
                eventTypeRepository, participationRepository, userService, authService, eventPublisher, notificationPushService);

        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));

        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        when(userService.findUserById(userId)).thenReturn(user);
        when(participationRepository.findByEventAndUser(event, user)).thenReturn(Optional.empty());

        ResponseEntity<MessageResponse<Void>> response = okResponse(null);
        Mockito.doReturn(response).when(messageService).buildResponse(eq("event.participation.set"), eq(null));

        try (MockedStatic<AuthUtils> mockedAuth = Mockito.mockStatic(AuthUtils.class)) {
            mockedAuth.when(AuthUtils::getCurrentUserId).thenReturn(userId);
            ResponseEntity<MessageResponse<Void>> actual = service.setParticipation(eventId, 1);
            assertThat(actual).isEqualTo(response);
        }

        verify(participationRepository).save(any(EventParticipation.class));
        verify(eventPublisher).publishEventUpdated(event);
    }

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}
