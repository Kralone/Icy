package com.icy.icy_backend.db.repository.event;

import com.icy.icy_backend.db.entity.event.OperationGroup;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.UUID;

public interface OperationGroupRepository extends CrudRepository<OperationGroup, Long> {
    List<OperationGroup> findByOperationEventIdOrderBySortOrderAscIdAsc(UUID operationEventId);
    /** Équipages qui suivent un preset. */
    List<OperationGroup> findByCrewPresetId(UUID crewPresetId);
    boolean existsByParentId(Long parentId);

    /** Lecture directe en base : vrai si le parent du groupe n'est plus celui attendu (groupe déplacé par une autre transaction). */
    @org.springframework.data.jpa.repository.Query("select count(g) > 0 from OperationGroup g where g.id = :id and (g.parentId is null or g.parentId <> :parentId)")
    boolean hasMovedFrom(@org.springframework.data.repository.query.Param("id") Long id, @org.springframework.data.repository.query.Param("parentId") Long parentId);

    /** Même contrôle pour un groupe qui était principal : vrai s'il a reçu un parent entre-temps. */
    boolean existsByIdAndParentIdIsNotNull(Long id);
    /** Lectures directes en base, à faire sous verrou : le type ou le mode des postes a pu changer depuis le chargement du groupe. */
    boolean existsByIdAndKind(Long id, OperationGroup.Kind kind);
    boolean existsByIdAndPositionMode(Long id, OperationGroup.PositionMode positionMode);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    java.util.Optional<OperationGroup> findLockedById(Long id);
}
