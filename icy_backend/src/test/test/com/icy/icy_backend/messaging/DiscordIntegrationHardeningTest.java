package com.icy.icy_backend.messaging;

import com.icy.icy_backend.config.RabbitConfig;
import com.icy.icy_backend.controller.dto.operation.OperationUpdateRequest;
import com.icy.icy_backend.db.entity.event.ActivityType;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRequestRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.event.EventService;
import com.icy.icy_backend.service.operation.OperationService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.listener.ListenerExecutionFailedException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Gate P1 : messages du bot en échec (D1), contenu de l'annonce (D2) et mise à jour d'une opération publiée (D3). */
class DiscordIntegrationHardeningTest {
    private final RabbitTemplate template = mock(RabbitTemplate.class);
    private final InboundMessageErrorHandler handler = new InboundMessageErrorHandler(template, 3);

    private static Message message(Integer retries) {
        MessageProperties properties = new MessageProperties();
        properties.setReceivedRoutingKey("events.participation");
        properties.setContentType("application/json");
        if (retries != null) properties.setHeader(InboundMessageErrorHandler.RETRY_COUNT_HEADER, retries);
        return new Message("{\"eventId\":\"x\"}".getBytes(StandardCharsets.UTF_8), properties);
    }

    private Object fail(Message message, Throwable cause) {
        return handler.handleError(message, null, null, new ListenerExecutionFailedException("échec", cause, message));
    }

    private Message sentTo(String exchange) {
        ArgumentCaptor<Message> sent = ArgumentCaptor.forClass(Message.class);
        verify(template).send(eq(exchange), eq("events.participation"), sent.capture());
        return sent.getValue();
    }

    @Test void anInvalidMessageIsParkedAtOnceAndNeverRetried() {
        fail(message(null), new IllegalArgumentException("Payload participation Discord invalide"));

        Message parked = sentTo(RabbitConfig.DEAD_LETTER_EXCHANGE);
        assertThat(parked.getMessageProperties().getHeaders()).containsEntry(InboundMessageErrorHandler.FAILURE_REASON_HEADER, "invalid_message");
        assertThat(new String(parked.getBody(), StandardCharsets.UTF_8)).isEqualTo("{\"eventId\":\"x\"}");
        verify(template, never()).send(eq(RabbitConfig.BACKEND_RETRY_EXCHANGE), anyString(), any(Message.class));
    }

    @Test void aRejectedConfirmationIsParkedToo() {
        fail(message(null), new AmqpRejectAndDontRequeueException("Confirmation Discord invalide", new NumberFormatException("abc")));

        assertThat(sentTo(RabbitConfig.DEAD_LETTER_EXCHANGE).getMessageProperties().getHeaders())
                .containsEntry(InboundMessageErrorHandler.FAILURE_REASON_HEADER, "invalid_message");
    }

    @Test void anUnreadableOrIncompleteMessageIsNotRetriedEither() {
        fail(message(null), new org.springframework.amqp.support.converter.MessageConversionException("Failed to convert message"));
        fail(message(null), new IllegalStateException("Confirmation Discord à réessayer", new NullPointerException("messageId")));

        verify(template, org.mockito.Mockito.times(2)).send(eq(RabbitConfig.DEAD_LETTER_EXCHANGE), eq("events.participation"), any(Message.class));
        verify(template, never()).send(eq(RabbitConfig.BACKEND_RETRY_EXCHANGE), anyString(), any(Message.class));
    }

    @Test void aTemporaryFailureIsRetriedAfterADelayWithItsAttemptCount() {
        fail(message(1), new IllegalStateException("Confirmation Discord à réessayer"));

        Message retried = sentTo(RabbitConfig.BACKEND_RETRY_EXCHANGE);
        assertThat(retried.getMessageProperties().getHeaders()).containsEntry(InboundMessageErrorHandler.RETRY_COUNT_HEADER, 2);
        assertThat(retried.getMessageProperties().getHeaders()).doesNotContainKey(InboundMessageErrorHandler.FAILURE_REASON_HEADER);
        verify(template, never()).send(eq(RabbitConfig.DEAD_LETTER_EXCHANGE), anyString(), any(Message.class));
    }

    @Test void afterTheLastAttemptTheMessageIsParkedInsteadOfLoopingForever() {
        fail(message(3), new IllegalStateException("base indisponible"));

        Message parked = sentTo(RabbitConfig.DEAD_LETTER_EXCHANGE);
        assertThat(parked.getMessageProperties().getHeaders())
                .containsEntry(InboundMessageErrorHandler.FAILURE_REASON_HEADER, "retries_exhausted")
                .containsEntry(InboundMessageErrorHandler.RETRY_COUNT_HEADER, 3);
        verify(template, never()).send(eq(RabbitConfig.BACKEND_RETRY_EXCHANGE), anyString(), any(Message.class));
    }

    @Test void ifTheMessageCannotBeMovedItIsNotAcknowledged() {
        doThrow(new AmqpException("RabbitMQ injoignable")).when(template).send(anyString(), anyString(), any(Message.class));

        assertThatThrownBy(() -> fail(message(null), new IllegalStateException("base indisponible"))).isInstanceOf(AmqpException.class);
    }

    @Test void theRetryQueueSendsMessagesBackToTheMainExchangeAfterItsDelay() {
        var queue = new RabbitConfig().backendRetryQueue();

        assertThat(queue.getArguments())
                .containsEntry("x-message-ttl", RabbitConfig.BACKEND_RETRY_DELAY_MS)
                .containsEntry("x-dead-letter-exchange", RabbitConfig.EXCHANGE);
        assertThat(queue.isDurable()).isTrue();
    }

    @Test void anAnswerToADeletedEventIsDroppedWithoutErrorAndWithoutRetry() {
        EventRepository events = mock(EventRepository.class);
        EventParticipationRepository participations = mock(EventParticipationRepository.class);
        EventPublisher publisher = mock(EventPublisher.class);
        DiscordEventParticipationListener listener = new DiscordEventParticipationListener(events, mock(UserRepository.class), participations, publisher,
                mock(OperationAssignmentRepository.class), mock(OperationAssignmentRequestRepository.class));
        UUID gone = UUID.randomUUID();
        when(events.findById(gone)).thenReturn(Optional.empty());

        listener.handleParticipation(Map.of("eventId", gone.toString(), "userId", "42", "username", "Kael", "status", 1));

        verifyNoInteractions(participations, publisher);
        // Une charge inexploitable reste une erreur : le gestionnaire la range en file morte.
        assertThatThrownBy(() -> listener.handleParticipation(Map.of("eventId", gone.toString(), "userId", "42", "status", 7)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> listener.handleParticipation(Map.of("eventId", "pas-un-uuid", "userId", "42", "status", 1)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test void theAnnouncementPayloadCarriesTheEndTime() {
        EventParticipationRepository participations = mock(EventParticipationRepository.class);
        EventPublisher publisher = new EventPublisher(template, participations, mock(OperationRepository.class));
        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setTitle("Soirée");
        event.setStartDateTime(LocalDateTime.of(2026, 11, 20, 20, 30));
        event.setEndDateTime(LocalDateTime.of(2026, 11, 20, 23, 30));
        when(participations.findAllByEvent(event)).thenReturn(Optional.empty());

        publisher.publishEventUpdated(event);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(template).convertAndSend(eq("icy.exchange"), eq("events.updated"), payload.capture());
        assertThat(payload.getValue()).containsEntry("date", "2026-11-20T20:30").containsEntry("endDate", "2026-11-20T23:30");
    }

    private Map<String, Object> publishedPayload(ActivityType activityType, LocalDateTime end) {
        EventParticipationRepository participations = mock(EventParticipationRepository.class);
        EventPublisher publisher = new EventPublisher(template, participations, mock(OperationRepository.class));
        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setTitle("Escorte");
        event.setActivityType(activityType);
        event.setStartDateTime(end.minusHours(3));
        event.setEndDateTime(end);
        when(participations.findAllByEvent(event)).thenReturn(Optional.empty());

        publisher.publishEventUpdated(event);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(template).convertAndSend(eq("icy.exchange"), eq("events.updated"), payload.capture());
        return payload.getValue();
    }

    @Test void anOperationPastItsEndIsAnnouncedAsClosedEvenBeforeTheScheduledTask() {
        assertThat(publishedPayload(ActivityType.OPERATION, LocalDateTime.now(com.icy.icy_backend.service.operation.OperationLock.ZONE).minusMinutes(2)))
                .containsEntry("finished", true);
    }

    @Test void anOperationStillRunningKeepsItsButtons() {
        assertThat(publishedPayload(ActivityType.OPERATION, LocalDateTime.now(com.icy.icy_backend.service.operation.OperationLock.ZONE).plusHours(2)))
                .containsEntry("finished", false);
    }

    @Test void aClassicEventPastItsEndKeepsItsOwnFinishedFlag() {
        assertThat(publishedPayload(ActivityType.EVENT, LocalDateTime.now(com.icy.icy_backend.service.operation.OperationLock.ZONE).minusMinutes(2)))
                .containsEntry("finished", false);
    }

    private record OperationFixture(OperationService service, EventService eventService, UUID id, Operation operation) {}

    private static OperationFixture operation(Operation.PublicationStatus status) {
        EventRepository events = mock(EventRepository.class);
        OperationRepository operations = mock(OperationRepository.class);
        EventService eventService = mock(EventService.class);
        OperationService service = new OperationService(events, operations, mock(MessageService.class), mock(EntityManager.class), new ObjectMapper());
        service.setEventService(eventService);
        UUID id = UUID.randomUUID();
        Event event = new Event();
        event.setId(id);
        event.setActivityType(ActivityType.OPERATION);
        event.setEndDateTime(LocalDateTime.now().plusDays(3));
        Operation operation = Operation.builder().eventId(id).event(event).publicationStatus(status)
                .briefing("Briefing").objectives("[{\"kind\":\"PRINCIPAL\",\"text\":\"Tenir\"}]").meetingPoint("Area18").imageUrl("https://example.test/a.webp").build();
        when(events.findById(id)).thenReturn(Optional.of(event));
        when(operations.findById(id)).thenReturn(Optional.of(operation));
        when(operations.save(operation)).thenReturn(operation);
        return new OperationFixture(service, eventService, id, operation);
    }

    private static OperationUpdateRequest sameContent() {
        OperationUpdateRequest request = new OperationUpdateRequest();
        request.setBriefing("Briefing");
        request.setObjectives("[{\"kind\":\"PRINCIPAL\",\"text\":\"Tenir\"}]");
        request.setMeetingPoint("Area18");
        request.setImageUrl("https://example.test/a.webp");
        return request;
    }

    @Test void changingWhatDiscordShowsOnAPublishedOperationRefreshesItsAnnouncementOnce() {
        for (String field : new String[]{"briefing", "objectives", "meetingPoint", "imageUrl"}) {
            OperationFixture fixture = operation(Operation.PublicationStatus.PUBLISHED);
            OperationUpdateRequest request = sameContent();
            switch (field) {
                case "briefing" -> request.setBriefing("Nouveau briefing");
                case "objectives" -> request.setObjectives("[{\"kind\":\"SECONDAIRE\",\"text\":\"Explorer\"}]");
                case "meetingPoint" -> request.setMeetingPoint("Port Tressler");
                default -> request.setImageUrl("https://example.test/b.webp");
            }

            fixture.service().update(fixture.id(), request);

            verify(fixture.eventService()).announceOperationContentChanged(fixture.id());
        }
    }

    @Test void savingAPublishedOperationWithoutVisibleChangeSendsNothing() {
        OperationFixture fixture = operation(Operation.PublicationStatus.PUBLISHED);
        OperationUpdateRequest request = sameContent();
        request.setAllowShipProposals(true);

        fixture.service().update(fixture.id(), request);

        verify(fixture.eventService(), never()).announceOperationContentChanged(any());
    }

    @Test void aDraftNeverReachesDiscordHoweverMuchItChanges() {
        OperationFixture fixture = operation(Operation.PublicationStatus.DRAFT);
        OperationUpdateRequest request = sameContent();
        request.setBriefing("Brouillon en cours de rédaction");
        request.setMeetingPoint("Ailleurs");

        fixture.service().update(fixture.id(), request);

        verify(fixture.eventService(), never()).announceOperationContentChanged(any());
        verify(fixture.eventService(), never()).announcePublishedOperation(any());
    }
}
