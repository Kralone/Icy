package com.icy.icy_backend.db.repository.event;
import com.icy.icy_backend.db.entity.event.OperationShipProposal;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;
public interface OperationShipProposalRepository extends JpaRepository<OperationShipProposal, UUID> {
    List<OperationShipProposal> findByOperationEventIdOrderByCreatedAtAsc(UUID operationEventId);
}
