package com.icy.icy_backend.db.repository.event;

import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.EventParticipation;
import com.icy.icy_backend.db.entity.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EventParticipationRepository extends JpaRepository<EventParticipation, UUID> {
    Optional<EventParticipation> findByEventAndUser(Event event, User user);
    Optional<List<EventParticipation>> findAllByEvent(Event event);
    void deleteAllByEvent(Event event);
    long countByUser_Id(UUID userId);
    long countByUser_IdAndStatus(UUID userId, int status);
    long countByUser_IdAndStatusAndEvent_FinishedTrue(UUID userId, int status);
}







