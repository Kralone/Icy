package com.icy.icy_backend.websocket.dto;

import com.icy.icy_backend.db.entity.Ship;
import lombok.Getter;

@Getter
public class ShipWebSocketMessage {
    private final String message;
    private final Ship ship;
    private final String type;

    public ShipWebSocketMessage(String message, Ship ship, String type) {
        this.message = message;
        this.ship = ship;
        this.type = type;
    }

}
