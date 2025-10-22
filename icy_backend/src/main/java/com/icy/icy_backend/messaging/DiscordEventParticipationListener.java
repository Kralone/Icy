package com.icy.icy_backend.messaging;

import com.icy.icy_backend.db.entity.Event;
import com.icy.icy_backend.db.entity.EventParticipation;
import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.db.repository.EventParticipationRepository;
import com.icy.icy_backend.db.repository.EventRepository;
import com.icy.icy_backend.db.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class DiscordEventParticipationListener {

    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final EventParticipationRepository participationRepository;
    private final EventPublisher eventPublisher;

    /**
     * Écoute les participations envoyées par le bot Discord.
     */
    @RabbitListener(queues = "events.participation.queue")
    public void handleParticipation(@Payload Map<String, Object> payload) {
        try {
            log.info("🎯 Participation reçue : {}", payload);

            String eventIdStr = (String) payload.get("eventId");
            String userIdStr = String.valueOf(payload.get("userId")); // Discord user id
            String username = (String) payload.get("username");
            int status = (int) payload.get("status");

            if (eventIdStr == null || userIdStr == null) {
                log.warn("⚠️ Données incomplètes dans le message RabbitMQ : {}", payload);
                return;
            }

            // 🔹 Trouver l'événement
            Event event = eventRepository.findById(java.util.UUID.fromString(eventIdStr))
                    .orElseThrow(() -> new IllegalStateException("Event non trouvé"));

            // 🔹 Trouver ou créer l’utilisateur
            User user = userRepository.findByDiscordId(userIdStr).orElseGet(() -> {
                User newUser = new User();
                newUser.setDiscordId(userIdStr);
                newUser.setUsername(username);
                newUser.setActive(true);
                return userRepository.save(newUser);
            });

            // 🔹 Trouver ou créer la participation
            Optional<EventParticipation> existing = participationRepository.findByEventAndUser(event, user);
            EventParticipation participation = existing.orElseGet(EventParticipation::new);

            participation.setEvent(event);
            participation.setUser(user);
            participation.setStatus(status);
            participationRepository.save(participation);

            log.info("✅ Participation enregistrée pour {} ({}) : {}", username, userIdStr, status);

            // 🔁 Publier la mise à jour complète de l'événement
            eventPublisher.publishEventUpdated(event);

        } catch (Exception e) {
            log.error("❌ Erreur lors du traitement d'une participation d'événement : ", e);
        }
    }
}
