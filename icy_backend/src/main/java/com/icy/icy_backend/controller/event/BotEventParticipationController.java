package com.icy.icy_backend.controller.event;

import com.icy.icy_backend.messaging.DiscordEventParticipationListener;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Réponse d'un membre depuis un bouton Discord. Le bot attend ce résultat avant de répondre au membre :
 * il n'annonce « enregistré » que si le serveur a réellement enregistré la réponse.
 */
@RestController
@RequestMapping("/api/events/bot")
@RequiredArgsConstructor
public class BotEventParticipationController {
    private final DiscordEventParticipationListener participations;

    public record Request(UUID eventId, String discordUserId, String username, Integer status) {}

    @PreAuthorize("hasRole('BOT')")
    @PostMapping("/participation")
    public ResponseEntity<Map<String, String>> record(@RequestBody Request request) {
        if (request == null || request.status() == null) throw new IllegalArgumentException("Payload participation Discord invalide");
        DiscordEventParticipationListener.Outcome outcome = participations.record(request.eventId(), request.discordUserId(), request.username(), request.status());
        return ResponseEntity.ok(Map.of("outcome", outcome.name()));
    }
}
