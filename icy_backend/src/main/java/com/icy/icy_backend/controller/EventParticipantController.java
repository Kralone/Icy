package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.db.entity.EventParticipant;
import com.icy.icy_backend.service.EventParticipantService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/event-participants")
public class EventParticipantController {
    private static final Logger logger = LoggerFactory.getLogger(EventParticipantController.class);
    private final EventParticipantService eventParticipantService;

    public EventParticipantController(EventParticipantService eventParticipantService) {
        this.eventParticipantService = eventParticipantService;
    }

    @GetMapping("/event/{eventId}")
    public ResponseEntity<MessageResponse<List<EventParticipant>>> getParticipantsByEvent(@PathVariable UUID eventId) {
        logger.debug("Requête reçue : récupération des participants pour l'événement ID : {}", eventId);
        return eventParticipantService.getParticipantsByEventId(eventId);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<MessageResponse<List<EventParticipant>>> getEventsByUser(@PathVariable UUID userId) {
        logger.debug("Requête reçue : récupération des événements pour l'utilisateur ID : {}", userId);
        return eventParticipantService.getEventsByUserId(userId);
    }
}