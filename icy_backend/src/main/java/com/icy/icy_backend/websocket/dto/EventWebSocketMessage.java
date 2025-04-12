package com.icy.icy_backend.websocket.dto;

import com.icy.icy_backend.controller.dto.response.EventResponseDTO;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class EventWebSocketMessage {
    private String message;
    private List<EventResponseDTO> events;
    private String action; // "ADD", "UPDATE", "DELETE"
}
