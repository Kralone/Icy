package com.icy.icy_backend.service.event;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.event.EventResponseDTO;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.EventParticipation;
import com.icy.icy_backend.db.entity.event.EventType;
import com.icy.icy_backend.db.entity.event.ActivityType;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
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
import org.mockito.ArgumentCaptor;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
    void createEventRejectsMissingOrInvalidDates() {
        EventService service = new EventService(Mockito.mock(EventRepository.class), Mockito.mock(MessageService.class),
                Mockito.mock(EventWebSocketService.class), Mockito.mock(EventTypeRepository.class),
                Mockito.mock(EventParticipationRepository.class), Mockito.mock(UserService.class),
                Mockito.mock(AuthService.class), Mockito.mock(EventPublisher.class), Mockito.mock(NotificationPushService.class));
        assertThatThrownBy(() -> service.createEvent("Type", "Title", "Desc", null, LocalDateTime.now()))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("obligatoires");
        LocalDateTime sameDate = LocalDateTime.now();
        assertThatThrownBy(() -> service.createEvent("Type", "Title", "Desc", sameDate, sameDate))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("postérieure");
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

    /** Lot 2 : une opération en brouillon n'existe pas pour les membres. */
    private static final class DraftFixture {
        final EventRepository eventRepository = Mockito.mock(EventRepository.class);
        final MessageService messageService = Mockito.mock(MessageService.class);
        final EventWebSocketService eventWebSocketService = Mockito.mock(EventWebSocketService.class);
        final EventParticipationRepository participationRepository = Mockito.mock(EventParticipationRepository.class);
        final UserService userService = Mockito.mock(UserService.class);
        final EventPublisher eventPublisher = Mockito.mock(EventPublisher.class);
        final NotificationPushService notificationPushService = Mockito.mock(NotificationPushService.class);
        final OperationRepository operationRepository = Mockito.mock(OperationRepository.class);
        final EventService service = new EventService(eventRepository, messageService, eventWebSocketService,
                Mockito.mock(EventTypeRepository.class), participationRepository, userService, Mockito.mock(AuthService.class), eventPublisher, notificationPushService);
        final Event classic = event("Classique", ActivityType.EVENT);
        final Event draft = event("Brouillon", ActivityType.OPERATION);
        final Event published = event("Publiée", ActivityType.OPERATION);

        DraftFixture() {
            service.setOperationRepository(operationRepository);
            when(operationRepository.findEventIdsByPublicationStatus(Operation.PublicationStatus.PUBLISHED)).thenReturn(List.of(published.getId()));
            when(operationRepository.findById(draft.getId())).thenReturn(Optional.of(Operation.builder().eventId(draft.getId()).build()));
            when(operationRepository.findById(published.getId())).thenReturn(Optional.of(Operation.builder().eventId(published.getId()).publicationStatus(Operation.PublicationStatus.PUBLISHED).build()));
            for (Event event : List.of(classic, draft, published)) when(eventRepository.findById(event.getId())).thenReturn(Optional.of(event));
        }

        private static Event event(String title, ActivityType activityType) {
            Event event = new Event();
            event.setId(UUID.randomUUID());
            event.setTitle(title);
            event.setActivityType(activityType);
            event.setStartDateTime(LocalDateTime.now().plusDays(1));
            event.setEndDateTime(LocalDateTime.now().plusDays(1).plusHours(2));
            return event;
        }

        @SuppressWarnings("unchecked")
        List<String> titlesSentAs(String messageKey) {
            ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
            verify(messageService).buildResponse(eq(messageKey), captor.capture());
            return ((List<EventResponseDTO>) captor.getValue()).stream().map(EventResponseDTO::getTitle).toList();
        }
    }

    @Test
    void memberListsLeaveOutDraftOperationsButKeepClassicEventsAndPublishedOperations() {
        DraftFixture fixture = new DraftFixture();
        List<Event> all = List.of(fixture.classic, fixture.draft, fixture.published);
        when(fixture.eventRepository.findByStartDateTimeAfterOrderByStartDateTimeAsc(any())).thenReturn(all);
        when(fixture.eventRepository.findAll()).thenReturn(all);
        when(fixture.eventRepository.findTop3ByFinishedTrueOrderByEndDateTimeDesc()).thenReturn(all);
        when(fixture.eventRepository.findByStartDateTimeBetweenOrderByStartDateTimeAsc(any(), any())).thenReturn(all);

        fixture.service.getUpcomingEvents();
        assertThat(fixture.titlesSentAs("event.upcoming")).containsExactly("Classique", "Publiée");
        assertThat(fixture.service.getAllEventsAsMap()).extracting(EventResponseDTO::getTitle).containsExactly("Classique", "Publiée");
        assertThat(fixture.service.getEventsBetween(java.time.LocalDate.now(), java.time.LocalDate.now().plusDays(7)))
                .extracting(Event::getTitle).containsExactly("Classique", "Publiée");
    }

    @Test
    void draftsAreListedOnlyForAnOrganizerWhoAsksForThem() {
        DraftFixture fixture = new DraftFixture();
        when(fixture.eventRepository.findAll()).thenReturn(List.of(fixture.classic, fixture.draft, fixture.published));

        try (MockedStatic<AuthUtils> mockedAuth = Mockito.mockStatic(AuthUtils.class)) {
            mockedAuth.when(AuthUtils::isAdmin).thenReturn(false);
            mockedAuth.when(() -> AuthUtils.hasRole("OFFICIER")).thenReturn(false);
            fixture.service.getAllEvents(true);
            assertThat(fixture.titlesSentAs("event.list")).containsExactly("Classique", "Publiée");
        }

        DraftFixture organizer = new DraftFixture();
        when(organizer.eventRepository.findAll()).thenReturn(List.of(organizer.classic, organizer.draft, organizer.published));
        try (MockedStatic<AuthUtils> mockedAuth = Mockito.mockStatic(AuthUtils.class)) {
            mockedAuth.when(AuthUtils::isAdmin).thenReturn(false);
            mockedAuth.when(() -> AuthUtils.hasRole("OFFICIER")).thenReturn(true);
            organizer.service.getAllEvents(true);
            assertThat(organizer.titlesSentAs("event.list")).containsExactly("Classique", "Brouillon", "Publiée");
        }
    }

    @Test
    void aMemberCannotReadOrAnswerADraftOperationByItsIdentifier() {
        DraftFixture fixture = new DraftFixture();
        UUID userId = UUID.randomUUID();

        try (MockedStatic<AuthUtils> mockedAuth = Mockito.mockStatic(AuthUtils.class)) {
            mockedAuth.when(AuthUtils::getCurrentUserId).thenReturn(userId);
            mockedAuth.when(AuthUtils::isAdmin).thenReturn(false);
            mockedAuth.when(() -> AuthUtils.hasRole("OFFICIER")).thenReturn(false);

            assertThatThrownBy(() -> fixture.service.getEventParticipations(fixture.draft.getId()))
                    .isInstanceOf(ResourceNotFoundException.class);
            assertThatThrownBy(() -> fixture.service.setParticipation(fixture.draft.getId(), 1))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        Mockito.verifyNoInteractions(fixture.participationRepository, fixture.eventPublisher);
    }

    @Test
    void aDraftOperationIsNotAnnouncedWhenCreatedUpdatedOrDeleted() {
        DraftFixture fixture = new DraftFixture();
        UUID userId = UUID.randomUUID();
        when(fixture.eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(fixture.participationRepository.findAllByEvent(any())).thenReturn(Optional.of(List.of()));

        try (MockedStatic<AuthUtils> mockedAuth = Mockito.mockStatic(AuthUtils.class)) {
            mockedAuth.when(AuthUtils::getCurrentUserId).thenReturn(userId);
            fixture.service.createEvent("Type", "Brouillon", "", LocalDateTime.now().plusDays(1), LocalDateTime.now().plusDays(1).plusHours(1), false);
        }
        fixture.service.updateEvent(fixture.draft.getId(), "Type", "Brouillon modifié", "", LocalDateTime.now().plusDays(2), LocalDateTime.now().plusDays(2).plusHours(1), false);
        fixture.service.deleteEvent(fixture.draft.getId());

        Mockito.verifyNoInteractions(fixture.eventWebSocketService, fixture.eventPublisher, fixture.notificationPushService);
    }

    @Test
    void anOperationKeepsItsParticipationsWhenItsDatesMoveAndItsHistoryOnceFinished() {
        DraftFixture fixture = new DraftFixture();
        when(fixture.eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Changer les dates d'une opération ne vide plus ses présences (ses affectations et ses vaisseaux en dépendent).
        fixture.service.updateEvent(fixture.published.getId(), "Type", "Publiée", "", LocalDateTime.now().plusDays(3), LocalDateTime.now().plusDays(3).plusHours(2), false);
        Mockito.verify(fixture.participationRepository, Mockito.never()).deleteAllByEvent(any());
        // Un événement classique garde son comportement : ses réponses sont remises à zéro.
        fixture.service.updateEvent(fixture.classic.getId(), "Type", "Classique", "", LocalDateTime.now().plusDays(3), LocalDateTime.now().plusDays(3).plusHours(2), false);
        Mockito.verify(fixture.participationRepository).deleteAllByEvent(fixture.classic);

        // Terminée, avec encore des présences : elle n'est pas supprimée.
        fixture.published.setEndDateTime(LocalDateTime.now().minusDays(1));
        when(fixture.participationRepository.findAllByEvent(fixture.published)).thenReturn(Optional.of(List.of()));
        when(fixture.participationRepository.countByEvent_Id(fixture.published.getId())).thenReturn(1L);
        assertThatThrownBy(() -> fixture.service.deleteEvent(fixture.published.getId()))
                .isInstanceOf(com.icy.icy_backend.exception.definition.OperationClosedException.class);
        Mockito.verify(fixture.eventRepository, Mockito.never()).delete(any(Event.class));
        Mockito.verify(fixture.participationRepository, Mockito.never()).deleteAllByEvent(fixture.published);

        // Sans présence ni affectation, il n'y a pas d'historique à conserver.
        when(fixture.participationRepository.countByEvent_Id(fixture.published.getId())).thenReturn(0L);
        fixture.service.deleteEvent(fixture.published.getId());
        Mockito.verify(fixture.eventRepository).delete(fixture.published);
    }

    @Test
    void publishingAnOperationAnnouncesItLikeANewEvent() {
        DraftFixture fixture = new DraftFixture();

        fixture.service.announcePublishedOperation(fixture.published.getId());

        verify(fixture.eventWebSocketService).sendEventUpdate(fixture.published, "ADD");
        verify(fixture.eventPublisher).publishEventCreated(fixture.published);
        verify(fixture.notificationPushService).sendBroadcast(any(), any(), any(), Mockito.anyInt());
    }

    /** Après l'heure de fin d'une opération publiée, la présence ne change plus ; un événement classique n'est pas concerné. */
    @Test
    void presenceIsLockedOnceAPublishedOperationIsPastItsEndWhateverTheFinishedFlag() {
        DraftFixture fixture = new DraftFixture();
        LocalDateTime past = LocalDateTime.now(com.icy.icy_backend.service.operation.OperationLock.ZONE).minusMinutes(1);
        fixture.published.setEndDateTime(past);
        fixture.published.setFinished(false);
        fixture.classic.setEndDateTime(past);
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        when(fixture.userService.findUserById(userId)).thenReturn(user);
        when(fixture.participationRepository.findByEventAndUser(any(), any())).thenReturn(Optional.empty());

        try (MockedStatic<AuthUtils> mockedAuth = Mockito.mockStatic(AuthUtils.class)) {
            mockedAuth.when(AuthUtils::getCurrentUserId).thenReturn(userId);
            mockedAuth.when(AuthUtils::isAdmin).thenReturn(true);

            for (int status : new int[] {1, 0, -1}) {
                assertThatThrownBy(() -> fixture.service.setParticipation(fixture.published.getId(), status))
                        .isInstanceOf(com.icy.icy_backend.exception.definition.OperationClosedException.class)
                        .hasMessageStartingWith("Opération terminée");
            }
            Mockito.verifyNoInteractions(fixture.participationRepository, fixture.eventPublisher);

            // Un événement classique dont la fin est passée garde son comportement.
            fixture.service.setParticipation(fixture.classic.getId(), 1);
        }

        verify(fixture.participationRepository).save(any(EventParticipation.class));
    }

    private static <T> ResponseEntity<MessageResponse<T>> okResponse(T data) {
        MessageResponse<T> body = new MessageResponse<>(HttpStatus.OK, "title", "message", 0, data);
        return ResponseEntity.ok(body);
    }
}
