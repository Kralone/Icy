package com.icy.icy_backend.db.repository.ship;

import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.brand.Brand;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ShipRepository extends JpaRepository<Ship, Long> {
    Optional<Ship> findByName(String name);
    List<Ship> findByBrand(Brand brand);
}






