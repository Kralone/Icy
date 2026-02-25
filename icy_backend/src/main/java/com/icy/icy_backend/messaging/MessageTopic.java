package com.icy.icy_backend.messaging;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Liste centralisée des clés de routage RabbitMQ utilisées dans le projet ICY.
 * Chaque valeur correspond à un "routing key" que le backend peut publier,
 * et que d'autres services (comme le bot Discord) peuvent écouter.
 */
@Getter
@RequiredArgsConstructor
public enum MessageTopic {

    // === NEWS ===
    NEWS_CREATED("news.created"),
    NEWS_UPDATED("news.updated"),
    NEWS_DELETED("news.deleted"),

    // === EVENTS ===
    EVENT_CREATED("event.created"),
    EVENT_UPDATED("event.updated"),
    EVENT_DELETED("event.deleted"),

    // === GOALS ===
    GOAL_CREATED("goal.created"),
    GOAL_UPDATED("goal.updated"),
    GOAL_COMPLETED("goal.completed"),

    // === USERS ===
    USER_REGISTERED("user.registered"),
    USER_UPDATED("user.updated"),

    // === AUTRES (placeholder futur) ===
    SYSTEM_ALERT("system.alert"),

    NEWS_DISCORD_LINKED("news.discordLinked");

    private final String routingKey;
}


