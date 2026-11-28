package com.icy.icy_backend.security.companion;

import com.icy.icy_backend.config.RabbitConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Messages RabbitMQ lus par le service compagnon, pour couper un accès avant la fin du jeton d'accès en cours
 * (5 min au plus) :
 * <ul>
 *   <li>{@value #MEMBER_REVOKED} : {@code userId}, {@code reason} (EXCLUDED, DEACTIVATED, PASSWORD_RESET, REVOKED) ;</li>
 *   <li>{@value #SESSION_REVOKED} : {@code userId}, {@code sessionId} (claim {@code sid} des jetons).</li>
 * </ul>
 * Publiés sur l'échange {@code icy.exchange}. Un envoi raté est journalisé et n'empêche jamais la révocation en base.
 */
@Component
public class CompanionAuthEvents {
    public static final String MEMBER_REVOKED = "companion.member.revoked";
    public static final String SESSION_REVOKED = "companion.session.revoked";

    private static final Logger log = LoggerFactory.getLogger(CompanionAuthEvents.class);
    private final RabbitTemplate rabbitTemplate;

    public CompanionAuthEvents(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void memberRevoked(UUID userId, String reason) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("userId", userId.toString());
        payload.put("reason", reason);
        payload.put("at", Instant.now().toString());
        send(MEMBER_REVOKED, payload);
    }

    public void sessionRevoked(UUID userId, String sessionId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("userId", userId.toString());
        payload.put("sessionId", sessionId);
        payload.put("at", Instant.now().toString());
        send(SESSION_REVOKED, payload);
    }

    private void send(String routingKey, Map<String, Object> payload) {
        try {
            rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, routingKey, payload);
            log.info("Révocation compagnon publiée : {} (membre {})", routingKey, payload.get("userId"));
        } catch (Exception e) {
            log.warn("RabbitMQ indisponible, révocation compagnon non diffusée : {} (membre {})",
                    routingKey, payload.get("userId"), e);
        }
    }
}
