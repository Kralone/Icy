package com.icy.icy_backend.config;

import com.icy.icy_backend.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class WebSocketConfigTest {

    @Test
    void authenticatesConnectFrameWithAccessToken() {
        JwtUtil jwtUtil = mock(JwtUtil.class);
        UUID userId = UUID.randomUUID();
        when(jwtUtil.validateToken("token")).thenReturn(true);
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(userId);
        when(jwtUtil.extractRoles("token")).thenReturn(List.of("USER"));

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setNativeHeader("Authorization", "Bearer token");

        new WebSocketConfig(jwtUtil).authenticate(accessor);

        assertThat(accessor.getUser()).isNotNull();
        assertThat(accessor.getUser().getName()).isEqualTo(userId.toString());
    }

    @Test
    void rejectsSubscriptionToAnotherUsersTopic() {
        JwtUtil jwtUtil = mock(JwtUtil.class);
        UUID userId = UUID.randomUUID();
        when(jwtUtil.validateToken("token")).thenReturn(true);
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(userId);
        when(jwtUtil.extractRoles("token")).thenReturn(List.of("USER"));

        WebSocketConfig config = new WebSocketConfig(jwtUtil);
        StompHeaderAccessor connect = StompHeaderAccessor.create(StompCommand.CONNECT);
        connect.setNativeHeader("Authorization", "Bearer token");
        config.authenticate(connect);

        StompHeaderAccessor subscribe = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        subscribe.setUser(connect.getUser());
        subscribe.setDestination("/topic/user/" + UUID.randomUUID() + "/notifications");

        assertThatThrownBy(() -> config.authorizeSubscription(subscribe))
                .isInstanceOf(AccessDeniedException.class);
    }
}
