package com.icy.icy_backend.config;

import com.icy.icy_backend.security.JwtUtil;
import com.icy.icy_backend.security.SecurityConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.web.socket.config.annotation.*;

import java.util.List;
import java.util.UUID;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final JwtUtil jwtUtil;
    private final List<String> allowedOrigins;

    public WebSocketConfig(JwtUtil jwtUtil,
                           @Value("${icy.cors.allowed-origins:https://iceforge.fr}") String allowedOrigins) {
        this.jwtUtil = jwtUtil;
        this.allowedOrigins = SecurityConfig.parseAllowedOrigins(allowedOrigins);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic"); // Broker pour envoyer les messages
        config.setApplicationDestinationPrefixes("/app"); // Préfixe pour les messages envoyés par le client
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigins.toArray(String[]::new))
                .withSockJS();
    }

    List<String> getAllowedOrigins() {
        return allowedOrigins;
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                return WebSocketConfig.this.preSend(message);
            }
        });
    }

    Message<?> preSend(Message<?> message) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            authenticate(accessor);
        } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            authorizeSubscription(accessor);
        } else if (StompCommand.SEND.equals(accessor.getCommand())) {
            throw new AccessDeniedException("Les émissions STOMP client sont interdites.");
        }
        return message;
    }

    void authenticate(StompHeaderAccessor accessor) {
        String authorization = accessor.getFirstNativeHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new AccessDeniedException("Jeton WebSocket manquant.");
        }

        String token = authorization.substring(7);
        if (!jwtUtil.validateToken(token)) {
            throw new AccessDeniedException("Jeton WebSocket invalide.");
        }

        UUID userId = jwtUtil.getUserIdFromToken(token);
        List<SimpleGrantedAuthority> authorities = jwtUtil.extractRoles(token).stream()
                .map(role -> role.startsWith("ROLE_") ? role : "ROLE_" + role)
                .map(SimpleGrantedAuthority::new)
                .toList();
        accessor.setUser(new UsernamePasswordAuthenticationToken(userId.toString(), null, authorities));
    }

    void authorizeSubscription(StompHeaderAccessor accessor) {
        if (accessor.getUser() == null) {
            throw new AccessDeniedException("Connexion WebSocket non authentifiée.");
        }

        String destination = accessor.getDestination();
        if (destination == null || !destination.startsWith("/topic/user/")) {
            return;
        }

        String[] segments = destination.split("/");
        if (segments.length < 4 || !accessor.getUser().getName().equals(segments[3])) {
            throw new AccessDeniedException("Abonnement WebSocket interdit.");
        }
    }
}
