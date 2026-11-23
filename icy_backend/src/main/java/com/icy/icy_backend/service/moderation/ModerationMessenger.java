package com.icy.icy_backend.service.moderation;

import java.util.UUID;

/**
 * Envoi d'un message privé Discord à un membre. L'envoi part après la validation de la transaction en cours ;
 * l'identifiant renvoyé permet de rattacher le résultat (reçu ou refusé) à l'avertissement ou à la décision.
 */
public interface ModerationMessenger {
    UUID send(String discordId, ModerationMessage message);
}
