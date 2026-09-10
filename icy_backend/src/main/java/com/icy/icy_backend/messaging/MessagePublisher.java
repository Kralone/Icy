package com.icy.icy_backend.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class MessagePublisher {

    private final RabbitTemplate rabbitTemplate;

    /**
     * Publie un message générique dans RabbitMQ.
     *
     * @param exchange   Exchange cible
     * @param routingKey Clé de routage
     * @param message    Contenu du message (Map ou DTO sérialisable)
     */
    public void publish(String exchange, String routingKey, Object message) {
        try {
            rabbitTemplate.convertAndSend(exchange, routingKey, message);
            log.info("Message envoyé vers {} [{}]", exchange, routingKey);
        } catch (Exception e) {
            log.error("Erreur lors de l’envoi du message vers RabbitMQ : {}", e.getMessage(), e);
        }
    }

    /** Bounded lifetime for automatic announcements; errors remain visible to the durable retry loop. */
    public void publishExpiring(String exchange, String routingKey, Object message, long ttlMillis) {
        if (ttlMillis <= 0) throw new IllegalArgumentException("TTL must be positive");
        rabbitTemplate.convertAndSend(exchange, routingKey, message, outgoing -> {
            outgoing.getMessageProperties().setExpiration(Long.toString(ttlMillis));
            return outgoing;
        });
    }

    /**
     * Envoie un message simple sous forme de Map.
     */
    public void publishSimple(String exchange, String routingKey, String type, String message) {
        publish(exchange, routingKey, Map.of("type", type, "message", message));
    }
}


