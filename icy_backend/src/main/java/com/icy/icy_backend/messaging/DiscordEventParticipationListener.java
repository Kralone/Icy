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
    private com.icy.icy_backend.websocket.OperationLiveUpdateService liveUpdates;

    /** Facultatif : sans lui (tests construits à la main), rien n'est signalé aux fiches ouvertes. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setLiveUpdates(com.icy.icy_backend.websocket.OperationLiveUpdateService liveUpdates) {
        this.liveUpdates = liveUpdates;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public void setOperationRepository(com.icy.icy_backend.db.repository.event.OperationRepository operationRepository) {
        this.operationRepository = operationRepository;
    }

    /** Ce qu'il est advenu d'une réponse donnée depuis Discord. Seul RECORDED signifie qu'elle est enregistrée. */
    public enum Outcome { RECORDED, UNKNOWN_USER, EVENT_NOT_FOUND, NOT_PUBLISHED, OPERATION_CLOSED }

    /**
     * Écoute les participations envoyées par le bot Discord.
     * Chemin historique : le bot interroge désormais directement le serveur pour connaître le résultat.
     */
    @RabbitListener(queues = "events.participation.queue", errorHandler = "inboundMessageErrorHandler")
    @Transactional
    public void handleParticipation(@Payload Map<String, Object> payload) {
        log.info("🎯 Participation reçue : {}", payload);

            String eventIdStr = String.valueOf(payload.get("eventId"));
            String userIdStr = String.valueOf(payload.get("userId")); // Discord user id
            String username = (String) payload.get("username");
            Object rawStatus = payload.get("status");
            int status = rawStatus instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(rawStatus));

            if (payload.get("eventId") == null || payload.get("userId") == null) throw new IllegalArgumentException("Payload participation Discord invalide");
            record(UUID.fromString(eventIdStr), userIdStr, username, status);
    }

    /**
     * Enregistre la réponse d'un membre identifié par son compte Discord, et dit ce qui s'est réellement passé.
     * Un compte Discord inconnu ou inactif, un événement supprimé ou une opération non publiée ne sont pas des erreurs :
     * rien n'est enregistré et le résultat le dit.
     */
    @Transactional
    public Outcome record(UUID eventId, String discordUserId, String username, int status) {
            if (eventId == null || discordUserId == null || discordUserId.isBlank() || !Set.of(-1, 0, 1).contains(status)) throw new IllegalArgumentException("Payload participation Discord invalide");
            String eventIdStr = eventId.toString();
            String userIdStr = discordUserId;

            // 🔹 Trouver l'événement. Supprimé entre-temps : la réponse est obsolète, la réessayer ne le ferait pas revenir.
            Event event = eventRepository.findById(eventId).orElse(null);
            if (event == null) {
                log.warn("Participation Discord ignorée : événement introuvable (ID={})", eventIdStr);
                return Outcome.EVENT_NOT_FOUND;
            }

            // Une opération non publiée n'accepte aucune réponse et ne repart pas vers Discord.
            if (event.getActivityType() == com.icy.icy_backend.db.entity.event.ActivityType.OPERATION && operationRepository != null
                    && operationRepository.findById(event.getId()).map(operation -> operation.getPublicationStatus() != com.icy.icy_backend.db.entity.event.Operation.PublicationStatus.PUBLISHED).orElse(true)) {
                log.warn("Participation Discord ignorée : opération non publiée (ID={})", eventIdStr);
                return Outcome.NOT_PUBLISHED;
            }

            // Même règle que sur le site : après l'heure de fin d'une opération publiée, les présences ne changent plus.
            if (com.icy.icy_backend.service.operation.OperationLock.isClosedNow(event)) {
                log.warn("Participation Discord refusée : opération terminée (ID={})", eventIdStr);
                return Outcome.OPERATION_CLOSED;
            }

            // 🔹 Trouver l’utilisateur existant (obligatoire)
            Optional<User> userOpt = userRepository.findByDiscordId(userIdStr);
            if (userOpt.isEmpty()) {
                log.warn("⚠️ Utilisateur Discord inconnu ({}) — participation ignorée.", username);
                return Outcome.UNKNOWN_USER;
            }

            User user = userOpt.get();

            // 🔹 Trouver ou créer la participation
            Optional<EventParticipation> existing = participationRepository.findByEventAndUser(event, user);
            EventParticipation participation = existing.orElseGet(EventParticipation::new);

            participation.setEvent(event);
            participation.setUser(user);
            participation.setStatus(status);
            participationRepository.save(participation);
            // Réponse donnée sur Discord : les fiches ouvertes la voient aussi.
            if (liveUpdates != null) liveUpdates.changed(event.getId());
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
            return Outcome.RECORDED;
    }
}





