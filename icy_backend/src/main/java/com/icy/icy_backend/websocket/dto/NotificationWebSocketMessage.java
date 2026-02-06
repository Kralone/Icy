package com.icy.icy_backend.websocket.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class NotificationWebSocketMessage {
    private String title;
    private String body;
    private String url;
}
