package com.icy.icy_backend.websocket.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class GoalWebSocketMessage {
    private String message;
    private Long goalId;
    private String action; // "CREATE", "UPDATE", "DELETE", "PIN", "INCREMENT"
}
