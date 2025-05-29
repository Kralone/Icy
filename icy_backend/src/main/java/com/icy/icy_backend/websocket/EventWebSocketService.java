package com.icy.icy_backend.websocket;

import com.icy.icy_backend.controller.dto.response.EventResponseDTO;
import com.icy.icy_backend.db.entity.Event;
import com.icy.icy_backend.websocket.dto.EventWebSocketMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

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
        List<EventResponseDTO> eventUpdate = new ArrayList<>();
        eventUpdate.add(dto);
        EventWebSocketMessage payload = new EventWebSocketMessage("Event update", eventUpdate, action);

        logger.info("🔁 Envoi WebSocket : {} {}", dto.getTitle(), action);
        messagingTemplate.convertAndSend(destination, payload);
    }
}
