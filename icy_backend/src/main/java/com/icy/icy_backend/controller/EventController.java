package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.db.entity.Event;
import com.icy.icy_backend.service.EventService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/events")
public class EventController {
    private static final Logger logger = LoggerFactory.getLogger(EventController.class);
    private final EventService eventService;

    public EventController(EventService eventService) {
        this.eventService = eventService;
    }

    @GetMapping
    public ResponseEntity<MessageResponse<List<Event>>> getAllEvents() {
        logger.debug("Requête reçue : récupération de la liste complète des événements");
        return eventService.getAllEvents();
    }

    @GetMapping("/{id}")
    public ResponseEntity<MessageResponse<Event>> getEventById(@PathVariable UUID id) {
        logger.debug("Requête reçue : récupération de l'événement avec l'ID : {}", id);
        return eventService.getEventById(id);
    }

    @PostMapping("/create")
    public ResponseEntity<MessageResponse<Event>> createEvent(@RequestBody Event event) {
        logger.debug("Requête reçue : création d'un nouvel événement");
        return eventService.createEvent(event);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<MessageResponse<Void>> deleteEvent(@PathVariable UUID id) {
        logger.debug("Requête reçue : suppression de l'événement avec l'ID : {}", id);
        return eventService.deleteEvent(id);
    }
}