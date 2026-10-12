package com.icy.icy_backend.db.repository.event;

import com.icy.icy_backend.db.entity.event.Operation;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface OperationRepository extends CrudRepository<Operation, UUID> {
    List<Operation> findByPublicationStatusOrderByUpdatedAtDesc(Operation.PublicationStatus publicationStatus);

    /** Date de dernière modification pour les groupes et besoins, sans avancer la révision : l'éditeur ouvert ne doit pas y voir un conflit. */
    @Modifying
    @Query("update Operation o set o.updatedAt = :at where o.eventId = :eventId")
    int markModified(@Param("eventId") UUID eventId, @Param("at") LocalDateTime at);
}
