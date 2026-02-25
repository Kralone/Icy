package com.icy.icy_backend.db.repository.utils;

import com.icy.icy_backend.db.entity.utils.WikeloShip;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WikeloShipRepository extends JpaRepository<WikeloShip, Long> {
    List<WikeloShip> findAllByOrderByShipNameAsc();
}
