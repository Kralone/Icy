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
    /**
     * Suppression en une requête, comptes désactivés compris. Le contexte de persistance est vidé ensuite : les réponses déjà
     * chargées ne doivent pas y rester, sinon la suppression de l'événement échoue à l'écriture (elles pointeraient vers un événement supprimé).
     */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("delete from EventParticipation p where p.event = :event")
    void deleteAllByEvent(@org.springframework.data.repository.query.Param("event") Event event);
    long countByUser_Id(UUID userId);
    /** Toutes les réponses, y compris celles de comptes désactivés (pas de jointure sur les utilisateurs). */
    long countByEvent_Id(UUID eventId);
    long countByUser_IdAndStatus(UUID userId, int status);
    long countByUser_IdAndStatusAndEvent_FinishedTrue(UUID userId, int status);
    boolean existsByEvent_IdAndUser_IdAndStatus(UUID eventId, UUID userId, int status);

    /** Réponses des membres actifs : un compte désactivé n'est pas chargé et ne fait pas échouer la lecture. */
    @org.springframework.data.jpa.repository.Query("select u.id as userId, u.username as username, p.status as status from EventParticipation p join p.user u where p.event.id = :eventId")
    List<ActiveParticipation> findActiveByEventId(@org.springframework.data.repository.query.Param("eventId") UUID eventId);

    /**
     * Vrai si ce membre a répondu à l'événement mais que son compte est désactivé (l'entité User ne charge que les comptes actifs).
     * Une réponse « Présent » laissée par un compte désactivé ne donne plus droit à une affectation.
     */
    @org.springframework.data.jpa.repository.Query("select count(p) > 0 from EventParticipation p where p.event.id = :eventId and p.user.id = :userId and not exists (select u.id from User u where u.id = :userId)")
    boolean isDeactivatedParticipant(@org.springframework.data.repository.query.Param("eventId") UUID eventId, @org.springframework.data.repository.query.Param("userId") UUID userId);

    interface ActiveParticipation {
        UUID getUserId();
        String getUsername();
        int getStatus();
    }
}







