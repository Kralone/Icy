package com.icy.icy_backend.db.repository.universe;

import com.icy.icy_backend.db.entity.universe.OreLocation;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OreLocationRepository extends JpaRepository<OreLocation, Long> {
    @EntityGraph(attributePaths = {"ores"})
    List<OreLocation> findAllByOrderByLocationCodeAsc();
}
