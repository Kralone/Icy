package com.icy.icy_backend.db.repository;

import com.icy.icy_backend.db.entity.Ship;
import com.icy.icy_backend.db.entity.Brand;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ShipRepository extends JpaRepository<Ship, Long> {
    Optional<Ship> findByName(String name);
    List<Ship> findByBrand(Brand brand);
}
