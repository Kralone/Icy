package com.icy.icy_backend.messaging;

import com.icy.icy_backend.config.RabbitConfig;
import com.icy.icy_backend.db.entity.member.DirectMessage;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.member.DirectMessageRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class DirectMessageServiceTest {
    private DirectMessageRepository messages;
    private MessagePublisher publisher;
    private ApplicationEventPublisher events;
    private DirectMessageService service;
    private User vexa;

    @BeforeEach
    void setUp() {
        messages = mock(DirectMessageRepository.class);
        when(messages.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        publisher = mock(MessagePublisher.class);
        events = mock(ApplicationEventPublisher.class);
        service = new DirectMessageService(messages, publisher, events);
        vexa = new User();
        vexa.setId(UUID.randomUUID());
        vexa.setUsername("Vexa");
        vexa.setDiscordId("190174996235026433");
    }

    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization();
    }

    @Test
    @SuppressWarnings("unchecked")
    void recordsThenPublishesTheMessageForTheBot() {
        DirectMessage saved = service.send(new DirectMessageService.Request(vexa, "REMINDER", "12", "Hello Vexa", null, "rappel-inactivite.gif", null));

        assertThat(saved.getStatus()).isEqualTo(DirectMessage.Status.PENDING);
        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(publisher).publish(eq(RabbitConfig.EXCHANGE), eq(RabbitConfig.DIRECT_MESSAGE_SEND_KEY), payload.capture());
        Map<String, Object> body = (Map<String, Object>) payload.getValue();
        assertThat(body).containsEntry("deliveryId", saved.getId().toString())
                .containsEntry("discordId", "190174996235026433")
                .containsEntry("content", "Hello Vexa")
                .containsEntry("mediaFile", "rappel-inactivite.gif")
                .containsEntry("reference", "12");
    }

    @Test
    void waitsForTheCallerToCommitBeforePublishing() {
        TransactionSynchronizationManager.initSynchronization();

        service.send(new DirectMessageService.Request(vexa, "WARNING", "7", null,
                new DirectMessageService.Embed("Avertissement", "Retard", 0xF87171, "IceForge"), null, null));

        verifyNoInteractions(publisher);
        List<TransactionSynchronization> pending = TransactionSynchronizationManager.getSynchronizations();
        pending.forEach(TransactionSynchronization::afterCommit);
        verify(publisher).publish(eq(RabbitConfig.EXCHANGE), eq(RabbitConfig.DIRECT_MESSAGE_SEND_KEY), any());
    }

    @Test
    void refusesEmptyOrTooLongMessagesAndMissingDiscordAccounts() {
        assertThatThrownBy(() -> service.send(new DirectMessageService.Request(vexa, "REMINDER", null, " ", null, null, null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.send(new DirectMessageService.Request(vexa, "REMINDER", null, "x".repeat(2001), null, null, null)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.send(new DirectMessageService.Request(vexa, "REMINDER", null, "ok", null, "../secret", null)))
                .isInstanceOf(BadRequestException.class);
        vexa.setDiscordId("pas-un-id");
        assertThatThrownBy(() -> service.send(new DirectMessageService.Request(vexa, "REMINDER", null, "ok", null, null, null)))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(publisher);
    }

    @Test
    void recordsTheBotAnswerAndAnnouncesIt() {
        DirectMessage pending = DirectMessage.builder().id(UUID.randomUUID()).userId(vexa.getId()).origin("WARNING").reference("7")
                .status(DirectMessage.Status.PENDING).requestedAt(LocalDateTime.now()).build();
        when(messages.findById(pending.getId())).thenReturn(Optional.of(pending));

        service.recordResult(pending.getId(), DirectMessage.Status.FAILED, "dm_closed");

        assertThat(pending.getStatus()).isEqualTo(DirectMessage.Status.FAILED);
        assertThat(pending.getCompletedAt()).isNotNull();
        verify(events).publishEvent(new DirectMessageResultEvent(pending.getId(), vexa.getId(), "WARNING", "7", DirectMessage.Status.FAILED, "dm_closed"));
    }

    @Test
    void aRepeatedAnswerIsIgnored() {
        DirectMessage sent = DirectMessage.builder().id(UUID.randomUUID()).userId(vexa.getId()).origin("REMINDER")
                .status(DirectMessage.Status.SENT).requestedAt(LocalDateTime.now()).build();
        when(messages.findById(sent.getId())).thenReturn(Optional.of(sent));

        service.recordResult(sent.getId(), DirectMessage.Status.SENT, null);

        verifyNoInteractions(events);
    }

    @Test
    void unansweredMessagesEndUpFailed() {
        DirectMessage stuck = DirectMessage.builder().id(UUID.randomUUID()).userId(vexa.getId()).origin("REMINDER")
                .status(DirectMessage.Status.PENDING).requestedAt(LocalDateTime.now().minusHours(2)).build();
        when(messages.findByStatusAndRequestedAtBefore(eq(DirectMessage.Status.PENDING), any())).thenReturn(List.of(stuck));

        service.expireUnanswered();

        assertThat(stuck.getStatus()).isEqualTo(DirectMessage.Status.FAILED);
        assertThat(stuck.getReason()).isEqualTo("no_answer");
        verify(events).publishEvent(any(DirectMessageResultEvent.class));
    }

    @Test
    void aDeliveredMessageStaysDeliveredWhateverArrivesLater() {
        DirectMessage sent = DirectMessage.builder().id(UUID.randomUUID()).userId(vexa.getId()).origin("REMINDER")
                .status(DirectMessage.Status.SENT).requestedAt(LocalDateTime.now()).build();
        when(messages.findById(sent.getId())).thenReturn(Optional.of(sent));

        service.recordResult(sent.getId(), DirectMessage.Status.FAILED, "forbidden");

        assertThat(sent.getStatus()).isEqualTo(DirectMessage.Status.SENT);
        verifyNoInteractions(events);
    }

    @Test
    void aLateConfirmationRepairsAMessageMarkedUnanswered() {
        DirectMessage expired = DirectMessage.builder().id(UUID.randomUUID()).userId(vexa.getId()).origin("REMINDER")
                .status(DirectMessage.Status.FAILED).reason("no_answer").requestedAt(LocalDateTime.now().minusHours(1)).build();
        when(messages.findById(expired.getId())).thenReturn(Optional.of(expired));

        service.recordResult(expired.getId(), DirectMessage.Status.SENT, null);

        assertThat(expired.getStatus()).isEqualTo(DirectMessage.Status.SENT);
        verify(events).publishEvent(any(DirectMessageResultEvent.class));
    }
}
