package com.icy.icy_backend.db.repository.event;

import com.icy.icy_backend.db.entity.event.EventType;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventTypeRepository extends JpaRepository<EventType, String> {
    EventType findByName(String name);
}






