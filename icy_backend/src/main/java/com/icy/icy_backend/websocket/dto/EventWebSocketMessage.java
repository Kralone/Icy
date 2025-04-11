package com.icy.icy_backend.websocket.dto;

import com.icy.icy_backend.controller.dto.response.EventResponseDTO;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class EventWebSocketMessage {
    private String message;
    private EventResponseDTO event;
    private String action; // "ADD", "UPDATE", "DELETE"
}
