package com.icy.icy_backend.db.repository.event;

import com.icy.icy_backend.db.entity.event.OperationShipRequirement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface OperationShipRequirementRepository extends JpaRepository<OperationShipRequirement, UUID> {
    List<OperationShipRequirement> findByOperationEventIdOrderByCreatedAtAsc(UUID operationEventId);

    /** Sérialise les propositions et acceptations d'un même besoin : sa quantité ne peut pas être dépassée. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    java.util.Optional<OperationShipRequirement> findLockedById(UUID id);
}
