package com.icy.icy_backend.controller.utils;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.utils.ExecutiveHangarConfigDTO;
import com.icy.icy_backend.controller.dto.utils.ExecutiveHangarPlayerStatusDTO;
import com.icy.icy_backend.controller.dto.utils.ExecutiveHangarSetNextOnlineRequest;
import com.icy.icy_backend.controller.dto.utils.ExecutiveHangarUpdatePlayerStatusRequest;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.utils.ExecutiveHangarService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/utils/executive-hangar")
public class ExecutiveHangarController {
    private final ExecutiveHangarService executiveHangarService;

    public ExecutiveHangarController(ExecutiveHangarService executiveHangarService) {
        this.executiveHangarService = executiveHangarService;
    }

    @GetMapping("/config")
    public ResponseEntity<MessageResponse<ExecutiveHangarConfigDTO>> getConfig() {
        return executiveHangarService.getConfig();
    }

    @PostMapping("/next-online")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<ExecutiveHangarConfigDTO>> setNextOnline(@RequestBody ExecutiveHangarSetNextOnlineRequest request) {
        return executiveHangarService.setNextOnline(request.getNextOnlineAt(), AuthUtils.getCurrentUserId());
    }

    @PostMapping("/reset")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<ExecutiveHangarConfigDTO>> resetConfig() {
        return executiveHangarService.resetConfig(AuthUtils.getCurrentUserId());
    }

    @GetMapping("/players")
    public ResponseEntity<MessageResponse<List<ExecutiveHangarPlayerStatusDTO>>> getPlayerStatuses() {
        return executiveHangarService.getPlayerStatuses();
    }

    @PutMapping("/players/{userId}")
    public ResponseEntity<MessageResponse<ExecutiveHangarPlayerStatusDTO>> setPlayerStatus(
            @PathVariable UUID userId,
            @RequestBody ExecutiveHangarUpdatePlayerStatusRequest request
    ) {
        boolean hasExecShip = request.getHasExecShip() != null && request.getHasExecShip();
        return executiveHangarService.setPlayerStatus(userId, hasExecShip, AuthUtils.getCurrentUserId());
    }
}
