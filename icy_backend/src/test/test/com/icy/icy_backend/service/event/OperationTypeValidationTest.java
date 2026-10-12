package com.icy.icy_backend.service.event;

import com.icy.icy_backend.db.entity.event.EventType;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.EventTypeRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.messaging.EventPublisher;
import com.icy.icy_backend.service.auth.AuthService;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.notification.NotificationPushService;
import com.icy.icy_backend.service.user.UserService;
import com.icy.icy_backend.websocket.EventWebSocketService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/** Lot 1 : liste fermée des types à la création d'opération (les événements classiques ne sont pas concernés). */
class OperationTypeValidationTest {

    private final EventTypeRepository eventTypeRepository = Mockito.mock(EventTypeRepository.class);
    private final EventService service = new EventService(
            Mockito.mock(EventRepository.class), Mockito.mock(MessageService.class), Mockito.mock(EventWebSocketService.class),
            eventTypeRepository, Mockito.mock(EventParticipationRepository.class), Mockito.mock(UserService.class),
            Mockito.mock(AuthService.class), Mockito.mock(EventPublisher.class), Mockito.mock(NotificationPushService.class));

    @Test
    void acceptsKnownTypeAndTrimsIt() {
        when(eventTypeRepository.findByName("Combat")).thenReturn(new EventType());
        assertThat(service.requireExistingEventTypeName("  Combat ")).isEqualTo("Combat");
    }

    @Test
    void rejectsUnknownType() {
        when(eventTypeRepository.findByName("Texte libre")).thenReturn(null);
        assertThatThrownBy(() -> service.requireExistingEventTypeName("Texte libre"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Type d’opération inconnu");
    }

    @Test
    void rejectsBlankType() {
        assertThatThrownBy(() -> service.requireExistingEventTypeName("  "))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Choisissez un type");
        assertThatThrownBy(() -> service.requireExistingEventTypeName(null))
                .isInstanceOf(BadRequestException.class);
    }
}
