package com.icy.icy_backend.websocket;

import com.icy.icy_backend.websocket.dto.GoalWebSocketMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class GoalWebSocketService {
    private static final Logger logger = LoggerFactory.getLogger(GoalWebSocketService.class);
    private static final String DESTINATION = "/topic/goals";

    private final SimpMessagingTemplate messagingTemplate;

    public GoalWebSocketService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void sendGoalUpdate(Long goalId, String action) {
        GoalWebSocketMessage payload = new GoalWebSocketMessage("Goal update", goalId, action);
        logger.info("🔁 Envoi WebSocket objectif : id={} action={}", goalId, action);
        messagingTemplate.convertAndSend(DESTINATION, payload);
    }
}
