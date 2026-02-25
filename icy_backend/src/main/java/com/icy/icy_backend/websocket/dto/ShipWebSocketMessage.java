package com.icy.icy_backend.websocket.dto;

import com.icy.icy_backend.controller.dto.response.user.UserShipDTO;
import com.icy.icy_backend.db.entity.ship.Ship;
import lombok.Getter;

@Getter
public class ShipWebSocketMessage {
    private final String message;
    private final UserShipDTO ship;
    private final String type;

    public ShipWebSocketMessage(String message, UserShipDTO ship, String type) {
        this.message = message;
        this.ship = ship;
        this.type = type;
    }

}





