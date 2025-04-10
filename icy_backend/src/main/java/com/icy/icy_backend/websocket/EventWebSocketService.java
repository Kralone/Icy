package com.icy.icy_backend.websocket;

import com.icy.icy_backend.controller.dto.response.EventResponseDTO;
import com.icy.icy_backend.db.entity.Event;
import com.icy.icy_backend.websocket.dto.EventWebSocketMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class EventWebSocketService {
    private static final Logger logger = LoggerFactory.getLogger(EventWebSocketService.class);
    private final SimpMessagingTemplate messagingTemplate;

    public EventWebSocketService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void sendEventUpdate(Event event, String action) {
        String destination = "/topic/events";
        EventResponseDTO dto = new EventResponseDTO(event);
        EventWebSocketMessage message = new EventWebSocketMessage("Événement mis à jour", dto, action);
        logger.info("WebSocket → {} : {}", action, dto.getTitle());
        messagingTemplate.convertAndSend(destination, message);
    }
}