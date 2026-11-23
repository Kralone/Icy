package com.icy.icy_backend.messaging;

import com.icy.icy_backend.db.entity.member.DirectMessage;

import java.util.UUID;

/**
 * Résultat d'un message privé, diffusé dans l'application une fois enregistré.
 * Chaque fonctionnalité écoute avec {@code @EventListener} et filtre sur son origin.
 * reason : dm_closed (MP fermés), user_not_found, discord_rejected, no_answer (le bot n'a pas répondu à temps),
 * media_missing ou media_too_large (envoyé sans le GIF).
 */
public record DirectMessageResultEvent(UUID deliveryId, UUID userId, String origin, String reference,
                                       DirectMessage.Status status, String reason) {
}
