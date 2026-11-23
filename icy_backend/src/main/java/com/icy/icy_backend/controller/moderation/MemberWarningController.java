package com.icy.icy_backend.controller.moderation;

import com.icy.icy_backend.controller.dto.moderation.ModerationDtos;
import com.icy.icy_backend.service.moderation.MemberWarningService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Avertissements disciplinaires, réservés aux Officiers et aux Directeurs.
 * Les décisions d'exclusion et la confirmation du ban Discord sont contrôlées dans le service (Directeur).
 */
@RestController
@RequestMapping("/api/admin/discipline")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
public class MemberWarningController {
    private final MemberWarningService service;

    @GetMapping
    public ModerationDtos.Summary summary() {
        return service.summary();
    }

    @GetMapping("/members/{userId}")
    public ModerationDtos.Record record(@PathVariable UUID userId) {
        return service.record(userId);
    }

    @PostMapping("/members/{userId}/warnings")
    @ResponseStatus(HttpStatus.CREATED)
    public ModerationDtos.Record warn(@PathVariable UUID userId, @RequestBody ModerationDtos.WarningRequest request) {
        return service.warn(userId, request);
    }

    @PostMapping("/warnings/{warningId}/revoke")
    public ModerationDtos.Record revoke(@PathVariable Long warningId, @RequestBody(required = false) ModerationDtos.RevokeRequest request) {
        return service.revoke(warningId, request);
    }

    @PostMapping("/warnings/{warningId}/resend")
    public ModerationDtos.Record resend(@PathVariable Long warningId) {
        return service.resend(warningId);
    }

    @PostMapping("/members/{userId}/decision")
    public ModerationDtos.Record decide(@PathVariable UUID userId, @RequestBody ModerationDtos.DecisionRequest request) {
        return service.decide(userId, request);
    }

    @PostMapping("/sanctions/{sanctionId}/discord-ban")
    public ModerationDtos.Record confirmDiscordBan(@PathVariable Long sanctionId) {
        return service.confirmDiscordBan(sanctionId);
    }
}
