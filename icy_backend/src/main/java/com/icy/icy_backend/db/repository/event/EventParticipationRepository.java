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
    /**
     * Les comptes désactivés sont filtrés par l'entité User : sans cette jointure, la réponse d'un membre désactivé
     * faisait échouer toute la liste de présence de l'événement.
     */
    @org.springframework.data.jpa.repository.Query("select p from EventParticipation p join fetch p.user where p.event = :event")
    Optional<List<EventParticipation>> findAllByEvent(@org.springframework.data.repository.query.Param("event") Event event);
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("delete from EventParticipation p where p.event = :event")
    void deleteAllByEvent(@org.springframework.data.repository.query.Param("event") Event event);
    long countByUser_Id(UUID userId);
    long countByUser_IdAndStatus(UUID userId, int status);
    long countByUser_IdAndStatusAndEvent_FinishedTrue(UUID userId, int status);
    boolean existsByEvent_IdAndUser_IdAndStatus(UUID eventId, UUID userId, int status);

    /** Réponses des membres actifs : un compte désactivé n'est pas chargé et ne fait pas échouer la lecture. */
    @org.springframework.data.jpa.repository.Query("select u.id as userId, u.username as username, p.status as status from EventParticipation p join p.user u where p.event.id = :eventId")
    List<ActiveParticipation> findActiveByEventId(@org.springframework.data.repository.query.Param("eventId") UUID eventId);

    interface ActiveParticipation {
        UUID getUserId();
        String getUsername();
        int getStatus();
    }
}







