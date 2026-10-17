package com.icy.icy_backend.db.repository.session;

import com.icy.icy_backend.db.entity.session.SessionSheet;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
}
