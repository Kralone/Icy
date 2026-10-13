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

    @Query("SELECT e FROM Event e WHERE e.startDateTime BETWEEN :start AND :end")
    List<Event> findAllBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);



}





