package com.icy.icy_backend.messaging;

import com.icy.icy_backend.config.RabbitConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserPublisher {

    private final MessagePublisher publisher;

    /**
     * 🔐 Envoie un mot de passe temporaire à l’utilisateur via le bot Discord.
     */
    public void sendTemporaryPassword(String discordId, String tempPassword) {
        Map<String, Object> payload = Map.of(
                "discordId", discordId,
                "tempPassword", tempPassword
        );

        publisher.publish(
                RabbitConfig.EXCHANGE,
                "users.password_reset",
                payload
        );

        log.info("📤 Message 'users.password_reset' envoyé à RabbitMQ pour Discord ID={}", discordId);
    }
}


