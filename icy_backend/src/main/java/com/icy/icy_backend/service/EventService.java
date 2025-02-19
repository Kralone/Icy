package com.icy.icy_backend.service;

import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.db.entity.Event;
import com.icy.icy_backend.db.repository.EventRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.service.rest.MessageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class EventService {
    private static final Logger logger = LoggerFactory.getLogger(EventService.class);
    private final EventRepository eventRepository;
    private final MessageService messageService;

    public EventService(EventRepository eventRepository, MessageService messageService) {
        this.eventRepository = eventRepository;
        this.messageService = messageService;
    }

    public ResponseEntity<MessageResponse<List<Event>>> getAllEvents() {
        logger.info("Récupération de tous les événements");
        List<Event> events = eventRepository.findAll();
        return messageService.buildResponse("event.found", events);
    }

    public ResponseEntity<MessageResponse<Event>> getEventById(UUID id) {
        logger.info("Recherche de l'événement ID: {}", id);
        Event event = eventRepository.findById(id).orElseThrow(() -> {
            logger.warn("Aucun événement trouvé avec l'ID: {}", id);
            return new ResourceNotFoundException("Aucun événement trouvé avec l'ID: " + id);
        });
        return messageService.buildResponse("event.found", event);
    }

    public ResponseEntity<MessageResponse<Event>> createEvent(Event event) {
        logger.info("Création d'un nouvel événement");
        if (eventRepository.existsById(event.getId())) {
            logger.warn("Un événement avec l'ID {} existe déjà", event.getId());
            return messageService.buildResponse("event.createfailed", null, "Un événement avec cet ID existe déjà: " + event.getId());
        }
        Event savedEvent = eventRepository.save(event);
        logger.info("Événement créé avec succès: {}", savedEvent.getId());
        return messageService.buildResponse("event.created", savedEvent);
    }

    public ResponseEntity<MessageResponse<Void>> deleteEvent(UUID id) {
        logger.info("Suppression de l'événement ID: {}", id);
        if (!eventRepository.existsById(id)) {
            logger.warn("Tentative de suppression d'un événement inexistant, ID: {}", id);
            return messageService.buildResponse("event.notfound", null, "Événement introuvable avec l'ID: " + id);
        }
        eventRepository.deleteById(id);
        logger.info("Événement supprimé: {}", id);
        return messageService.buildResponse("event.deleted", null);
    }
}
