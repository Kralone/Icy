package com.icy.icy_backend.db.repository.event;
import com.icy.icy_backend.db.entity.event.OperationAssignmentRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;
public interface OperationAssignmentRequestRepository extends JpaRepository<OperationAssignmentRequest, UUID> {
 Optional<OperationAssignmentRequest> findFirstByOperationEventIdAndUserIdAndStatusOrderByCreatedAtDesc(UUID operationId, UUID userId, OperationAssignmentRequest.Status status);
}
