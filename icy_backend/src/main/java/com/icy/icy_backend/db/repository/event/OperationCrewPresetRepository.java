package com.icy.icy_backend.db.repository.event;

import com.icy.icy_backend.db.entity.event.OperationCrewPreset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OperationCrewPresetRepository extends JpaRepository<OperationCrewPreset, UUID> {
    List<OperationCrewPreset> findAllByOrderByShipModelNameAscNameAsc();
}
