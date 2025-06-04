package com.icy.icy_backend.db.repository;

import com.icy.icy_backend.db.entity.Event;
import org.springframework.data.repository.CrudRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface EventRepository extends CrudRepository<Event, UUID> {

    List<Event> findByStartDateTimeAfterOrderByStartDateTimeAsc(LocalDateTime now);
    List<Event> findByEndDateTimeBetweenAndFinishedFalse(LocalDateTime start, LocalDateTime end);

}