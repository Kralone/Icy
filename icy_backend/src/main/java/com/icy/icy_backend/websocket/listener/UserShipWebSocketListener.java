package com.icy.icy_backend.websocket.listener;

import com.icy.icy_backend.controller.dto.response.ship.FleetSummaryResponse;
import com.icy.icy_backend.controller.dto.response.user.UserShipDTO;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.service.user.UserService;
import com.icy.icy_backend.service.user.UserShipService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.websocket.dto.FleetWebSocketMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@Slf4j
public class UserShipWebSocketListener {

    private final UserService userService;
    private final UserShipService userShipService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    public UserShipWebSocketListener(UserService userService, UserShipService userShipService,
                                     SimpMessagingTemplate messagingTemplate, ObjectMapper objectMapper) {
        this.userService = userService;
        this.userShipService = userShipService;
        this.messagingTemplate = messagingTemplate;
        this.objectMapper = objectMapper;
    }

    @EventListener
    public void onUserShipSubscribe(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String destination = accessor.getDestination();

        if (destination != null && destination.startsWith("/topic/user/") && destination.endsWith("/ships")) {
            try {
                String userUuid = destination.split("/")[3];
                User user = userService.findUserById(UUID.fromString(userUuid));

                List<UserShipDTO> ships = userShipService.getShipsByUserIdDTO(user.getId());
                String payload = objectMapper.writeValueAsString(ships);

                messagingTemplate.convertAndSend(destination, payload);
                log.info("💬 Vaisseaux envoyés via WebSocket pour {}", userUuid);

            } catch (Exception e) {
                log.error("❌ Erreur d'envoi des vaisseaux initiaux pour topic {} : {}", destination, e.getMessage());
            }

        } else if ( destination != null && destination.equals("/topic/fleet/update")) {
            try {
                List<FleetSummaryResponse> fleetSummary = userShipService.getFleetSummaryAsList();
                String message = "Fleet connected";
                FleetWebSocketMessage payload = new FleetWebSocketMessage(message, fleetSummary);


                messagingTemplate.convertAndSend(destination, payload);
                log.info("💬 Flotte update envoyés via WebSocket");
            } catch (Exception e) {
                log.error("❌ Erreur d'envoi de fleet initial");
            }

        }
    }
}




