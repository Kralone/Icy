package com.icy.icy_backend.websocket;

import com.icy.icy_backend.websocket.dto.NotificationWebSocketMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class NotificationWebSocketService {
    private static final Logger logger = LoggerFactory.getLogger(NotificationWebSocketService.class);
    private final SimpMessagingTemplate messagingTemplate;

    public NotificationWebSocketService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void sendBroadcast(String title, String body, String url, int priority) {
        String destination = "/topic/notifications";
        NotificationWebSocketMessage payload = new NotificationWebSocketMessage(title, body, url, priority);
        logger.info("Envoi notification broadcast WebSocket");
        messagingTemplate.convertAndSend(destination, payload);
    }

    public void sendToUsers(List<UUID> userIds, String title, String body, String url, int priority) {
        NotificationWebSocketMessage payload = new NotificationWebSocketMessage(title, body, url, priority);
        for (UUID userId : userIds) {
            String destination = "/topic/user/" + userId + "/notifications";
            logger.info("Envoi notification WebSocket a {}", destination);
            messagingTemplate.convertAndSend(destination, payload);
        }
    }
}
