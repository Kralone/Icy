package com.icy.icy_backend.websocket;

import com.icy.icy_backend.websocket.dto.FleetWebSocketMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ShipFleetWebSocketService {
    private static final Logger logger = LoggerFactory.getLogger(UserWebSocketService.class);
    private final SimpMessagingTemplate messagingTemplate;

    public ShipFleetWebSocketService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void sendShipFleetUpdate(Map<String, List<String>> fleetSummary) {
        String destination = "/topic/fleet/update";
        String message = "Fleet updated";
        FleetWebSocketMessage payload = new FleetWebSocketMessage(message, fleetSummary);

        logger.info("Envoi d'une mise à jour WebSocket à {} : {}", destination, message);
        messagingTemplate.convertAndSend(destination, payload);
    }
}
