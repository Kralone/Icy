package com.icy.icy_backend.db.repository.event;

import com.icy.icy_backend.db.entity.event.OperationGroup;
import org.springframework.data.repository.CrudRepository;
import java.util.List;
import java.util.UUID;

public interface OperationGroupRepository extends CrudRepository<OperationGroup, Long> {
    List<OperationGroup> findByOperationEventIdOrderBySortOrderAscIdAsc(UUID operationEventId);
}
