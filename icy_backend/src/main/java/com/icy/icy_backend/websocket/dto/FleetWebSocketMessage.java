package com.icy.icy_backend.websocket.dto;

import com.icy.icy_backend.controller.dto.response.ship.FleetSummaryResponse;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import lombok.Getter;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

@Getter
public class FleetWebSocketMessage
{
    private final String message;
    private final List<FleetSummaryResponse> fleet;

    public FleetWebSocketMessage(String message,List<FleetSummaryResponse> fleet) {
        this.message = message;
        this.fleet = fleet;
    }
}



