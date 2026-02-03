package com.icy.icy_backend.messaging;

import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.db.entity.scworldevent.ScWorldEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ScWorldEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    // Adapte le nom de l'exchange selon ta config RabbitMQ
    private static final String EXCHANGE_NAME = "icy.exchange";
    private static final String ROUTING_KEY_TIER_PASSED = "scwe.tier_passed";

    /**
     * Publie un événement RabbitMQ lors du passage d'un palier (SCWE).
     *
     * @param event L'événement SCWE
     * @param user Le joueur
     * @param milestoneLabel Le nom du palier (ex: "1er palier", "Expert Transport")
     * @param categoryName Le contexte (ex: "Global", "Transport", "Combat")
     * @param imageUrl L'image spécifique du palier (si vide, on prendra celle de l'event)
     */
    public void publishTierPassed(ScWorldEvent event, User user, String milestoneLabel, String categoryName, String imageUrl, String rewardText) {
        Map<String, Object> payload = new HashMap<>();

        payload.put("eventId", event.getId());
        payload.put("userId", user.getId());
        payload.put("eventName", event.getTitle());
        payload.put("username", user.getUsername());
        payload.put("milestoneLabel", milestoneLabel);
        payload.put("category", categoryName);

        // ✅ NOUVEAU : Ajout de la récompense dans le message
        if (rewardText != null && !rewardText.isBlank()) {
            payload.put("rewardText", rewardText);
        }

        // Description Discord
        String description;
        if ("Global".equalsIgnoreCase(categoryName)) {
            description = String.format("**%s** a franchi le **%s** sur l'événement **%s** !",
                    user.getUsername(), milestoneLabel, event.getTitle());
        } else {
            description = String.format("**%s** a atteint le palier **%s** dans la catégorie **%s** !",
                    user.getUsername(), milestoneLabel, categoryName);
        }
        payload.put("discordDescription", description);

        // Image
        String finalImage = (imageUrl != null && !imageUrl.isBlank()) ? imageUrl : event.getBannerImageUrl();
        payload.put("imageUrl", finalImage);

        try {
            rabbitTemplate.convertAndSend(EXCHANGE_NAME, ROUTING_KEY_TIER_PASSED, payload);
            log.info("📤 [SCWE] Palier publié : {} - {} (Reward: {})", user.getUsername(), milestoneLabel, rewardText);
        } catch (Exception e) {
            log.error("❌ Erreur RabbitMQ SCWE : {}", e.getMessage());
        }
    }
}