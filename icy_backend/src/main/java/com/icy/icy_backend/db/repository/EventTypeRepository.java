package com.icy.icy_backend.db.repository;

import com.icy.icy_backend.db.entity.EventType;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventTypeRepository extends JpaRepository<EventType, String> {
    EventType findByName(String name);
}
