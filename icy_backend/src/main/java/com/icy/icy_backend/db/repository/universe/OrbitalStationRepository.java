package com.icy.icy_backend.db.repository.universe;

import com.icy.icy_backend.db.entity.universe.OrbitalStation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrbitalStationRepository extends JpaRepository<OrbitalStation, Long> {
    List<OrbitalStation> findAllByOrderBySystemNameAscSortOrderAscNameAsc();
}
