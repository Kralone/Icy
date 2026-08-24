package com.icy.icy_backend.websocket;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class MiningSheetWebSocketService {
    private static final String DESTINATION = "/topic/mining-sheets";
    private final SimpMessagingTemplate messagingTemplate;

    public MiningSheetWebSocketService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void broadcast(String action, UUID sheetId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("action", action);
        payload.put("sheetId", sheetId);
        payload.put("timestamp", System.currentTimeMillis());
        messagingTemplate.convertAndSend(DESTINATION, (Object) payload);
    }
}
