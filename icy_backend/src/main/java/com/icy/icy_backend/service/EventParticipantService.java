package com.icy.icy_backend.service;

import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.db.entity.EventParticipant;
import com.icy.icy_backend.db.repository.EventParticipantRepository;
import com.icy.icy_backend.service.rest.MessageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class EventParticipantService {
    private static final Logger logger = LoggerFactory.getLogger(EventParticipantService.class);
    private final EventParticipantRepository eventParticipantRepository;
    private final MessageService messageService;

    public EventParticipantService(EventParticipantRepository eventParticipantRepository, MessageService messageService) {
        this.eventParticipantRepository = eventParticipantRepository;
        this.messageService = messageService;
    }

    public ResponseEntity<MessageResponse<List<EventParticipant>>> getParticipantsByEventId(UUID eventId) {
        logger.info("Récupération des participants pour l'événement ID: {}", eventId);
        List<EventParticipant> participants = eventParticipantRepository.findByEventId(eventId);
        return messageService.buildResponse("event.participants.found", participants);
    }

    public ResponseEntity<MessageResponse<List<EventParticipant>>> getEventsByUserId(UUID userId) {
        logger.info("Récupération des événements pour l'utilisateur ID: {}", userId);
        List<EventParticipant> events = eventParticipantRepository.findByUserId(userId);
        return messageService.buildResponse("user.events.found", events);
    }

    public ResponseEntity<MessageResponse<EventParticipant>> addParticipant(EventParticipant participant) {
        logger.info("Ajout d'un participant à l'événement ID: {}", participant.getEvent().getId());
        EventParticipant savedParticipant = eventParticipantRepository.save(participant);
        return messageService.buildResponse("event.participant.added", savedParticipant);
    }
}
