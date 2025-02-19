package com.icy.icy_backend.db.repository;

import com.icy.icy_backend.db.entity.EventParticipant;
import com.icy.icy_backend.db.entity.id.EventParticipantId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EventParticipantRepository extends JpaRepository<EventParticipant, EventParticipantId> {
    List<EventParticipant> findByEventId(UUID eventId);
    List<EventParticipant> findByUserId(UUID userId);
}
