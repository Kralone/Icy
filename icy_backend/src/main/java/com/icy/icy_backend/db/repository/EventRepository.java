package com.icy.icy_backend.db.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

import com.icy.icy_backend.db.entity.Event;

public interface EventRepository extends JpaRepository<Event, UUID> {
}
