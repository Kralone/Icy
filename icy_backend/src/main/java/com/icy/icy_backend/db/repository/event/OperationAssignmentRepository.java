package com.icy.icy_backend.db.repository.event;

import com.icy.icy_backend.db.entity.event.OperationAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OperationAssignmentRepository extends JpaRepository<OperationAssignment, UUID> {
    Optional<OperationAssignment> findByOperationEventIdAndUserId(UUID operationEventId, UUID userId);
    List<OperationAssignment> findByOperationEventId(UUID operationEventId);
    long countByOperationEventIdAndGroupIdAndStatus(UUID operationEventId, Long groupId, OperationAssignment.Status status);
    long countByPositionIdAndStatus(Long positionId, OperationAssignment.Status status);
    long countByPositionIdAndStatusAndUserIdNot(Long positionId, OperationAssignment.Status status, UUID userId);
    boolean existsByGroupIdAndPositionIdIsNotNull(Long groupId);

    /**
     * Écrit le seul poste, et seulement si le membre est toujours confirmé dans ce groupe :
     * un transfert concurrent n'est ni écrasé ni suivi d'un poste de l'ancien équipage. Rend le nombre de lignes modifiées.
     */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("update OperationAssignment a set a.positionId = :positionId where a.id = :id and a.groupId = :groupId and a.status = com.icy.icy_backend.db.entity.event.OperationAssignment.Status.CONFIRMED")
    int setPosition(@org.springframework.data.repository.query.Param("id") UUID id, @org.springframework.data.repository.query.Param("groupId") Long groupId, @org.springframework.data.repository.query.Param("positionId") Long positionId);
    /** Rejoint la transaction de l'appelant ; ouvre la sienne s'il n'y en a pas. */
    @org.springframework.transaction.annotation.Transactional
    void deleteByOperationEventIdAndUserId(UUID operationEventId, UUID userId);
}
