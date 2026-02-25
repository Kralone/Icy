package com.icy.icy_backend.db.repository.universe;

import com.icy.icy_backend.db.entity.universe.CelestialBody;
import com.icy.icy_backend.db.entity.universe.CelestialBodyType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CelestialBodyRepository extends JpaRepository<CelestialBody, Long> {
    List<CelestialBody> findAllByOrderBySystemNameAscBodyTypeAscSortOrderAscNameAsc();
    List<CelestialBody> findAllByBodyTypeOrderBySystemNameAscSortOrderAscNameAsc(CelestialBodyType bodyType);
    boolean existsByNameIgnoreCaseAndBodyType(String name, CelestialBodyType bodyType);
    boolean existsByNameIgnoreCaseAndBodyTypeAndIdNot(String name, CelestialBodyType bodyType, Long id);
}
