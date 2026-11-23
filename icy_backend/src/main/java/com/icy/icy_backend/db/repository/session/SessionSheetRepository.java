package com.icy.icy_backend.db.repository.session;

import com.icy.icy_backend.db.entity.session.SessionSheet;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionSheetRepository extends JpaRepository<SessionSheet, UUID> {
    /**
     * Verrou d'écriture sur la fiche : toutes les écritures d'une même fiche passent l'une après l'autre,
     * ce qui rend sûrs les contrôles de stock et l'arrêt des comptes.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from SessionSheet s where s.id = :id")
    Optional<SessionSheet> lockById(@Param("id") UUID id);

    Optional<SessionSheet> findByOperationEventId(UUID operationEventId);

    List<SessionSheet> findAllByOrderBySessionDateDescCreatedAtDesc();

    List<SessionSheet> findTop4ByActivityInOrderBySessionDateDescCreatedAtDesc(Collection<String> activities);

    /** Fiches d'une activité dont la date tombe entre deux jours inclus : les fiches prévues plus tard n'y entrent pas. */
    long countByActivityInAndSessionDateBetween(Collection<String> activities, LocalDate since, LocalDate until);

    long countByActivityInAndStatusNot(Collection<String> activities, SessionSheet.Status status);

    /** Membres distincts inscrits sur les fiches de ces activités datées entre deux jours inclus. */
    @Query("select count(distinct p.userId) from SessionParticipant p where p.sheetId in "
            + "(select s.id from SessionSheet s where s.activity in :activities and s.sessionDate between :since and :until)")
    long countParticipantsBetween(@Param("activities") Collection<String> activities, @Param("since") LocalDate since, @Param("until") LocalDate until);

    /** Total des ventes (aUEC) réalisées depuis un instant sur les fiches de ces activités, quelle que soit la date de la fiche. */
    @Query("select coalesce(sum(x.amount), 0) from SessionSale x where x.soldAt >= :since and x.sheetId in "
            + "(select s.id from SessionSheet s where s.activity in :activities)")
    long sumSalesSince(@Param("activities") Collection<String> activities, @Param("since") LocalDateTime since);
}
