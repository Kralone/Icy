package com.icy.icy_backend.messaging;

import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.EventParticipation;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRepository;
import com.icy.icy_backend.db.repository.event.OperationAssignmentRequestRepository;
import com.icy.icy_backend.db.entity.event.OperationAssignmentRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DiscordEventParticipationListener {

    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final EventParticipationRepository participationRepository;
    private final EventPublisher eventPublisher;
    private final OperationAssignmentRepository operationAssignmentRepository;
    private final OperationAssignmentRequestRepository operationAssignmentRequestRepository;
    private com.icy.icy_backend.db.repository.event.OperationRepository operationRepository;

    @org.springframework.beans.factory.annotation.Autowired
    public void setOperationRepository(com.icy.icy_backend.db.repository.event.OperationRepository operationRepository) {
        this.operationRepository = operationRepository;
    }

    /**
     * Écoute les participations envoyées par le bot Discord.
     */
    @RabbitListener(queues = "events.participation.queue")
    @Transactional
    public void handleParticipation(@Payload Map<String, Object> payload) {
        log.info("🎯 Participation reçue : {}", payload);

            String eventIdStr = String.valueOf(payload.get("eventId"));
            String userIdStr = String.valueOf(payload.get("userId")); // Discord user id
            String username = (String) payload.get("username");
            Object rawStatus = payload.get("status");
            int status = rawStatus instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(rawStatus));

            if (payload.get("eventId") == null || payload.get("userId") == null || !Set.of(-1, 0, 1).contains(status)) throw new IllegalArgumentException("Payload participation Discord invalide");

            // 🔹 Trouver l'événement
            Event event = eventRepository.findById(UUID.fromString(eventIdStr))
                    .orElseThrow(() -> new IllegalStateException("Event non trouvé (ID=" + eventIdStr + ")"));

            // Une opération non publiée n'accepte aucune réponse et ne repart pas vers Discord.
            if (event.getActivityType() == com.icy.icy_backend.db.entity.event.ActivityType.OPERATION && operationRepository != null
                    && operationRepository.findById(event.getId()).map(operation -> operation.getPublicationStatus() != com.icy.icy_backend.db.entity.event.Operation.PublicationStatus.PUBLISHED).orElse(true)) {
                log.warn("Participation Discord ignorée : opération non publiée (ID={})", eventIdStr);
                return;
            }

            // 🔹 Trouver l’utilisateur existant (obligatoire)
            Optional<User> userOpt = userRepository.findByDiscordId(userIdStr);
            if (userOpt.isEmpty()) {
                log.warn("⚠️ Utilisateur Discord inconnu ({}) — participation ignorée.", username);
                return;
            }

            User user = userOpt.get();

            // 🔹 Trouver ou créer la participation
            Optional<EventParticipation> existing = participationRepository.findByEventAndUser(event, user);
            EventParticipation participation = existing.orElseGet(EventParticipation::new);

            participation.setEvent(event);
            participation.setUser(user);
            participation.setStatus(status);
            participationRepository.save(participation);
            if (status != 1 && !com.icy.icy_backend.service.operation.OperationLock.isClosedNow(event)) {
                operationAssignmentRepository.deleteByOperationEventIdAndUserId(event.getId(), user.getId());
                operationAssignmentRequestRepository.deleteByOperationEventIdAndUserIdAndStatus(event.getId(), user.getId(), OperationAssignmentRequest.Status.PENDING);
            }

            log.info("✅ Participation enregistrée pour {} ({}) : {}", username, userIdStr, status);

            // Publier uniquement après commit : Discord ne doit pas voir une
            // participation que la transaction pourrait encore annuler.
            Runnable publishUpdate = () -> eventPublisher.publishEventUpdated(event);
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        publishUpdate.run();
                    }
                });
            } else {
                publishUpdate.run();
            }

    }
}





