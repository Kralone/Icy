package com.icy.icy_backend.db.repository.scworldevent;

import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventParticipation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ScWorldEventParticipationRepository extends JpaRepository<ScWorldEventParticipation, UUID> {
    Optional<ScWorldEventParticipation> findByScWorldEvent_IdAndUser_Id(UUID scweId, UUID userId);
    List<ScWorldEventParticipation> findAllByUser_Id(UUID userId);

    @Query("SELECT p FROM ScWorldEventParticipation p " +
            "LEFT JOIN FETCH p.user " +
            "WHERE p.scWorldEvent.id = :eventId " +
            "ORDER BY p.total DESC")
    Page<ScWorldEventParticipation> findLeaderboard(@Param("eventId") UUID eventId, Pageable pageable);

}
