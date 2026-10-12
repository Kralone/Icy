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
    /** Appelée aussi hors transaction (changement de présence) : elle ouvre alors la sienne. */
    @org.springframework.transaction.annotation.Transactional
    void deleteByOperationEventIdAndUserId(UUID operationEventId, UUID userId);
}
