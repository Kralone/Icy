package com.icy.icy_backend.db.repository.event;

import com.icy.icy_backend.db.entity.event.Event;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface EventRepository extends CrudRepository<Event, UUID> {

    List<Event> findByStartDateTimeAfterOrderByStartDateTimeAsc(LocalDateTime now);
    List<Event> findByEndDateTimeBetweenAndFinishedFalse(LocalDateTime start, LocalDateTime end);
    List<Event> findByEndDateTimeBeforeAndFinishedFalse(LocalDateTime dateTime);
    List<Event> findByStartDateTimeBetweenOrderByStartDateTimeAsc(LocalDateTime start, LocalDateTime end);
    List<Event> findTop3ByFinishedTrueOrderByEndDateTimeDesc();

    /** Fin enregistrée, lue en base sous verrou partagé : une modification de date en cours attend la fin de l'écriture qui s'y fie. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_READ)
    @Query("select e.endDateTime from Event e where e.id = :id")
    java.util.Optional<LocalDateTime> lockEndDateTime(@Param("id") UUID id);

    /** Une activité de pôle se montre si c'est un événement, ou une opération publiée. */
    String POLE_VISIBLE = "(e.activityType <> com.icy.icy_backend.db.entity.event.ActivityType.OPERATION or exists "
            + "(select 1 from Operation o where o.eventId = e.id "
            + "and o.publicationStatus = com.icy.icy_backend.db.entity.event.Operation.PublicationStatus.PUBLISHED)) ";

    /** Activités d'un pôle pas encore terminées, les plus proches d'abord ; les opérations non publiées n'y figurent pas. */
    @Query("select e from Event e where e.pole = :pole and e.endDateTime >= :now and " + POLE_VISIBLE
            + "order by e.startDateTime asc")
    List<Event> findUpcomingOfPole(@Param("pole") com.icy.icy_backend.db.entity.user.Specialty pole, @Param("now") LocalDateTime now,
                                   org.springframework.data.domain.Pageable page);

    @Query("select count(e) from Event e where e.pole = :pole and e.endDateTime >= :now and " + POLE_VISIBLE)
    long countUpcomingOfPole(@Param("pole") com.icy.icy_backend.db.entity.user.Specialty pole, @Param("now") LocalDateTime now);

    /** Activités d'un pôle déjà terminées, les plus récentes d'abord. */
    @Query("select e from Event e where e.pole = :pole and e.endDateTime < :now and " + POLE_VISIBLE
            + "order by e.endDateTime desc")
    List<Event> findPastOfPole(@Param("pole") com.icy.icy_backend.db.entity.user.Specialty pole, @Param("now") LocalDateTime now,
                               org.springframework.data.domain.Pageable page);

    /** Nombre d'activités d'un pôle terminées entre deux instants. */
    @Query("select count(e) from Event e where e.pole = :pole and e.endDateTime >= :since and e.endDateTime < :now and " + POLE_VISIBLE)
    long countEndedOfPoleBetween(@Param("pole") com.icy.icy_backend.db.entity.user.Specialty pole,
                                 @Param("since") LocalDateTime since, @Param("now") LocalDateTime now);

    /** Nombre de membres distincts ayant confirmé leur présence à une activité du pôle terminée entre deux instants. */
    @Query("select count(distinct p.user.id) from EventParticipation p join p.event e where p.status = 1 "
            + "and e.pole = :pole and e.endDateTime >= :since and e.endDateTime < :now and " + POLE_VISIBLE)
    long countParticipantsOfPoleBetween(@Param("pole") com.icy.icy_backend.db.entity.user.Specialty pole,
                                        @Param("since") LocalDateTime since, @Param("now") LocalDateTime now);

    @Query("SELECT e FROM Event e WHERE e.startDateTime BETWEEN :start AND :end")
    List<Event> findAllBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);



}





