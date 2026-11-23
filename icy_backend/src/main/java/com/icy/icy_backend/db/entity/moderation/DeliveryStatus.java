package com.icy.icy_backend.db.entity.moderation;

/** Suivi du message privé envoyé par le bot : en cours, reçu par Discord ou refusé. */
public enum DeliveryStatus {
    PENDING, SENT, FAILED
}
