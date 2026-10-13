package com.icy.icy_backend.service.operation;

import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.Operation;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.OperationRepository;
import com.icy.icy_backend.exception.definition.OperationClosedException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;

/**
 * Clôture automatique : dès l'heure de fin d'une opération publiée, son organisation (affectations, demandes, groupes,
 * besoins, vaisseaux) n'est plus modifiable, par personne. Les dates sont enregistrées en heure de Paris ; c'est l'horloge
 * du serveur qui fait foi, jamais le drapeau « finished », mis à jour avec retard par une tâche planifiée.
 * Un brouillon n'a pas eu lieu : il n'est jamais clôturé.
 */
@Component
@RequiredArgsConstructor
public class OperationLock {
    public static final ZoneId ZONE = ZoneId.of("Europe/Paris");
    public static final String MESSAGE = "Opération terminée : son organisation n’est plus modifiable.";
    public static final String PRESENCE_MESSAGE = "Opération terminée : les présences ne sont plus modifiables.";

    private final OperationRepository operationRepository;
    private final EventRepository eventRepository;
    private Clock clock = Clock.system(ZONE);

    void setClock(Clock clock) {
        this.clock = clock;
    }

    /**
     * À appeler dans la transaction d'écriture, avant toute modification. La fin est relue en base sous verrou partagé,
     * puis comparée à l'heure courante : un contrôle qui commence à l'heure de fin ou après est toujours refusé.
     * Limite assumée : une écriture contrôlée juste avant la fin peut être validée quelques millisecondes après.
     */
    public void requireOpen(UUID operationId) {
        boolean published = operationRepository.findById(operationId)
                .map(operation -> operation.getPublicationStatus() == Operation.PublicationStatus.PUBLISHED).orElse(false);
        if (!published) return;
        LocalDateTime end = eventRepository.lockEndDateTime(operationId).orElse(null);
        if (isClosed(end, LocalDateTime.now(clock))) throw new OperationClosedException(MESSAGE);
    }

    public static boolean isClosed(LocalDateTime end, LocalDateTime now) {
        return end != null && !now.isBefore(end);
    }

    /** Opération dont la fin est passée : sa composition ne doit plus bouger, même par un changement de présence. */
    public static boolean isClosedNow(Event event) {
        return event.getActivityType() == com.icy.icy_backend.db.entity.event.ActivityType.OPERATION
                && isClosed(event.getEndDateTime(), LocalDateTime.now(ZONE));
    }

    /** Pour l'affichage : même règle, sans verrou. */
    public static boolean isClosed(Event event, Operation operation) {
        return operation.getPublicationStatus() == Operation.PublicationStatus.PUBLISHED
                && isClosed(event.getEndDateTime(), LocalDateTime.now(ZONE));
    }
}
