package com.icy.icy_backend.service.session;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Effets d'une écriture, déclenchés seulement après validation en base :
 * mise à jour en direct des fiches ouvertes (WebSocket) et notifications Discord (RabbitMQ, clés mining.*).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SessionEvents {
    static final String LIST_TOPIC = "/topic/sessions";
    static final String SHEET_TOPIC_PREFIX = "/topic/sessions/";
    static final String EXCHANGE = "icy.exchange";

    private final SimpMessagingTemplate messagingTemplate;
    private final RabbitTemplate rabbitTemplate;

    /** Le message ne porte que l'identifiant : chaque lecteur relit la fiche avec ses propres droits. */
    public void changed(UUID sheetId) {
        afterCommit(() -> {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("sheetId", sheetId);
            payload.put("timestamp", System.currentTimeMillis());
            messagingTemplate.convertAndSend(SHEET_TOPIC_PREFIX + sheetId, (Object) payload);
            messagingTemplate.convertAndSend(LIST_TOPIC, (Object) payload);
        });
    }

    public void notifyDiscord(String routingKey, Map<String, Object> payload) {
        afterCommit(() -> {
            try {
                rabbitTemplate.convertAndSend(EXCHANGE, routingKey, payload);
                log.info("Notification de fiche de minage envoyée : {}", routingKey);
            } catch (Exception exception) {
                // La fiche reste juste : seule l'annonce Discord est perdue.
                log.warn("RabbitMQ indisponible, notification de fiche de minage ignorée : {}", routingKey, exception);
            }
        });
    }

    private static void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            action.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                action.run();
            }
        });
    }
}
