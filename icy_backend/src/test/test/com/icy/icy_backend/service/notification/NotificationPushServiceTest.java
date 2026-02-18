package com.icy.icy_backend.service.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.controller.dto.notification.NotificationSubscriptionRequest;
import com.icy.icy_backend.db.repository.notification.NotificationSubscriptionRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.websocket.NotificationWebSocketService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.security.GeneralSecurityException;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationPushServiceTest {

    @Test
    void subscribeThrowsWhenVapidMissing() throws GeneralSecurityException {
        NotificationSubscriptionRepository subscriptionRepository = Mockito.mock(NotificationSubscriptionRepository.class);
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        ObjectMapper objectMapper = new ObjectMapper();
        NotificationWebSocketService notificationWebSocketService = Mockito.mock(NotificationWebSocketService.class);

        NotificationPushService service = new NotificationPushService(
                subscriptionRepository, userRepository, objectMapper, notificationWebSocketService,
                "", "", ""
        );

        assertThatThrownBy(() -> service.subscribe(UUID.randomUUID(), new NotificationSubscriptionRequest()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void sendToUsersNoopWhenUserListEmpty() throws GeneralSecurityException {
        NotificationSubscriptionRepository subscriptionRepository = Mockito.mock(NotificationSubscriptionRepository.class);
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        ObjectMapper objectMapper = new ObjectMapper();
        NotificationWebSocketService notificationWebSocketService = Mockito.mock(NotificationWebSocketService.class);

        NotificationPushService service = new NotificationPushService(
                subscriptionRepository, userRepository, objectMapper, notificationWebSocketService,
                "", "", ""
        );

        service.sendToUsers(List.of(), "t", "b", "/x", 1);
        Mockito.verifyNoInteractions(subscriptionRepository);
    }

    @Test
    void sendBroadcastCallsWebsocket() throws GeneralSecurityException {
        NotificationSubscriptionRepository subscriptionRepository = Mockito.mock(NotificationSubscriptionRepository.class);
        UserRepository userRepository = Mockito.mock(UserRepository.class);
        ObjectMapper objectMapper = new ObjectMapper();
        NotificationWebSocketService notificationWebSocketService = Mockito.mock(NotificationWebSocketService.class);

        NotificationPushService service = new NotificationPushService(
                subscriptionRepository, userRepository, objectMapper, notificationWebSocketService,
                "", "", ""
        );

        when(subscriptionRepository.findAll()).thenReturn(List.of());
        service.sendBroadcast("title", "body", "/url", 2);
        verify(notificationWebSocketService).sendBroadcast("title", "body", "/url", 2);
    }
}
