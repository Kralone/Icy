package com.icy.icy_backend.db.repository.event;

import com.icy.icy_backend.db.entity.event.OperationCrewPresetPosition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface OperationCrewPresetPositionRepository extends JpaRepository<OperationCrewPresetPosition, Long> {
    List<OperationCrewPresetPosition> findByPresetIdOrderBySortOrderAscIdAsc(UUID presetId);
    List<OperationCrewPresetPosition> findByPresetIdInOrderBySortOrderAscIdAsc(Collection<UUID> presetIds);

    /** Suppression directe : les nouveaux postes du même preset peuvent être insérés dans la même transaction sans heurter l'unicité des libellés. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from OperationCrewPresetPosition p where p.presetId = :presetId")
    void deleteAllByPresetId(@Param("presetId") UUID presetId);
}
