package com.icy.icy_backend.db.repository.event;

import com.icy.icy_backend.db.entity.event.OperationGroupPosition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;

public interface OperationGroupPositionRepository extends JpaRepository<OperationGroupPosition, Long> {
    List<OperationGroupPosition> findByGroupIdOrderBySortOrderAscIdAsc(Long groupId);
    List<OperationGroupPosition> findByGroupIdInOrderBySortOrderAscIdAsc(Collection<Long> groupIds);
    long countByGroupId(Long groupId);
    /** Rejoint la transaction de l'appelant ; ouvre la sienne s'il n'y en a pas. */
    @Transactional
    void deleteByGroupId(Long groupId);
}
