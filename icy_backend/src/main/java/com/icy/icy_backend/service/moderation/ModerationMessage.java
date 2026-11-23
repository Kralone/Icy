package com.icy.icy_backend.service.moderation;

/** Message privé envoyé à un membre par le bot, sous forme de carte colorée. color est un entier RVB. */
public record ModerationMessage(String title, String description, int color, String footer) {
}
