package com.icy.icy_backend.controller.scworldevent;

import com.icy.icy_backend.controller.dto.scworldevent.UpsertScWorldEventParticipationDTO;
import com.icy.icy_backend.controller.dto.response.scworldevent.ScWorldEventParticipationDTO;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.scworldevent.ScWorldEventParticipationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sc-world-events")
@RequiredArgsConstructor
public class ScWorldEventParticipationController {

    private final ScWorldEventParticipationService service;

    /**
     * Renvoie toutes les participations de l'utilisateur connecté
     * (utilisé par le frontend: /api/sc-world-events/participations/me)
     */
    @GetMapping("/participations/me")
    public ResponseEntity<List<ScWorldEventParticipationDTO>> myParticipations() {
        UUID userId = AuthUtils.getCurrentUserId();
        return ResponseEntity.ok(
                service.getAllForUser(userId).stream()
                        .map(ScWorldEventParticipationDTO::from)
                        .toList()
        );
    }

    /**
     * Participation de l'utilisateur connecté pour un event donné
     * (utilisé par le frontend: /api/sc-world-events/{id}/participation/me)
     */
    @GetMapping("/{id:[0-9a-fA-F\\-]{36}}/participation/me")
    public ResponseEntity<ScWorldEventParticipationDTO> myParticipation(@PathVariable("id") UUID scweId) {
        UUID userId = AuthUtils.getCurrentUserId();
        return ResponseEntity.ok(
                ScWorldEventParticipationDTO.from(service.getForUserAndEventOrThrow(scweId, userId))
        );
    }

    /**
     * Upsert participation de l'utilisateur connecté (join/update points/status)
     * (utilisé par le frontend: /api/sc-world-events/{id}/participation/me)
     */
    @PutMapping("/{id:[0-9a-fA-F\\-]{36}}/participation/me")
    public ResponseEntity<ScWorldEventParticipationDTO> upsertMe(
            @PathVariable("id") UUID scweId,
            @RequestBody UpsertScWorldEventParticipationDTO dto
    ) {
        UUID userId = AuthUtils.getCurrentUserId();
        return ResponseEntity.ok(
                ScWorldEventParticipationDTO.from(service.upsert(scweId, userId, dto))
        );
    }

    /**
     * Mode admin/tech: Provide either userId (UUID) or discordId (String). If both are provided, userId is used.
     * (on garde ton endpoint existant, mais on force aussi l'UUID regex)
     */
    @PutMapping("/{id:[0-9a-fA-F\\-]{36}}/participation")
    public ResponseEntity<ScWorldEventParticipationDTO> upsert(
            @PathVariable("id") UUID scweId,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) String discordId,
            @RequestBody UpsertScWorldEventParticipationDTO dto
    ) {
        Object identifier = (userId != null) ? userId : discordId;
        if (identifier == null) {
            throw new IllegalArgumentException("userId ou discordId est requis.");
        }

        return ResponseEntity.ok(
                ScWorldEventParticipationDTO.from(service.upsert(scweId, identifier, dto))
        );
    }

    @GetMapping("/event/{eventId}/leaderboard")
    public ResponseEntity<Page<ScWorldEventParticipationDTO>> getLeaderboard(
            @PathVariable UUID eventId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(service.getLeaderboard(eventId, page, size)
                .map(ScWorldEventParticipationDTO::from));
    }
}


