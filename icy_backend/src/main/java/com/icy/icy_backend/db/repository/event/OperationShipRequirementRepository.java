package com.icy.icy_backend.db.repository.event;

import com.icy.icy_backend.db.entity.event.OperationShipRequirement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface OperationShipRequirementRepository extends JpaRepository<OperationShipRequirement, UUID> {
    List<OperationShipRequirement> findByOperationEventIdOrderByCreatedAtAsc(UUID operationEventId);
}
