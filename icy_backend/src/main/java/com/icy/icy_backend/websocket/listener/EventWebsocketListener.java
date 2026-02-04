package com.icy.icy_backend.websocket.listener;

import com.icy.icy_backend.controller.dto.response.event.EventResponseDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.service.event.EventService;
import com.icy.icy_backend.websocket.dto.EventWebSocketMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.core.AbstractDestinationResolvingMessagingTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.util.List;

@Component
@Slf4j
public class EventWebsocketListener {

    private final EventService eventService;
    private final SimpMessagingTemplate messagingTemplate;

    public EventWebsocketListener(EventService eventService, SimpMessagingTemplate messagingTemplate) {
        this.eventService = eventService;
        this.messagingTemplate = messagingTemplate;
    }

    @EventListener
    public void onEventSubscribe(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String destination = accessor.getDestination();

        if(destination != null && destination.startsWith("/topic/events")) {
            try {
                List<EventResponseDTO> events = eventService.getAllEventsAsMap();
                String message = "Event Connected";
                EventWebSocketMessage payload = new EventWebSocketMessage(message, events, "INIT");

                messagingTemplate.convertAndSend(destination, payload);
                log.info("💬 Events envoyés via WebSocket");
            } catch (Exception e) {
                log.error("❌ Erreur d'envoi d'event initial");
            }
        }
    }
}



