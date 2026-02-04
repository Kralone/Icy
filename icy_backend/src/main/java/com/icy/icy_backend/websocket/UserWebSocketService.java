package com.icy.icy_backend.websocket;

import com.icy.icy_backend.controller.dto.response.user.UserShipDTO;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.user.UserShip;
import com.icy.icy_backend.websocket.dto.ShipWebSocketMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class UserWebSocketService {
    private static final Logger logger = LoggerFactory.getLogger(UserWebSocketService.class);
    private final SimpMessagingTemplate messagingTemplate;

    public UserWebSocketService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Envoie une mise à jour WebSocket à un utilisateur spécifique lorsqu'un vaisseau est ajouté.
     */
    public void sendUserShipUpdate(UserShip userShip) {
        String destination = "/topic/user/" + userShip.getUser().getId() + "/ships" ;

        UserShipDTO ship = new UserShipDTO(userShip);

        String message = "Vaisseau ajouté : " + ship.getName();
        ShipWebSocketMessage payload = new ShipWebSocketMessage(message, ship, "ADD");

        logger.info("Envoi d'une mise à jour WebSocket à {} : {}", destination, message);
        messagingTemplate.convertAndSend(destination, payload);
    }

    public void sendUserShipDeletion(UserShip userShip) {
        String destination = "/topic/user/" + userShip.getUser().getId() + "/ships";
        String message = "Vaisseau supprimé : ID " + userShip.getShip().getId();

        UserShipDTO ship = new UserShipDTO(userShip);

        ShipWebSocketMessage payload = new ShipWebSocketMessage(message, ship, "DELETE");

        logger.info("Envoi d'une notification de suppression de vaisseau à {} : {}", destination, message);
        messagingTemplate.convertAndSend(destination, payload);
    }

}





