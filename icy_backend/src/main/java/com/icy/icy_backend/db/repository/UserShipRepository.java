package com.icy.icy_backend.db.repository;

import com.icy.icy_backend.db.entity.Ship;
import com.icy.icy_backend.db.entity.UserShip;
import com.icy.icy_backend.db.entity.id.UserShipId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface UserShipRepository extends JpaRepository<UserShip, UserShipId> {
    List<UserShip> findByUserId(UUID userId);
    List<UserShip> findByUserDiscordId(Long discordId);

    @Query("SELECT us FROM UserShip us JOIN FETCH us.ship")
    List<UserShip> findAllWithShips();


    @Query("SELECT s FROM Ship s JOIN UserShip us ON us.ship.id = s.id WHERE us.user.id = :userId ORDER BY s.brand.name")
    List<Ship> findShipsByUserId(@Param("userId") UUID userId);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserShip us WHERE us.user.id = :userId AND us.ship.id = :shipId")
    void deleteByUserIdAndShipId(@Param("userId") UUID userId, @Param("shipId") Long shipId);



    boolean existsByUserIdAndShipId(UUID userId, Long shipId);


}