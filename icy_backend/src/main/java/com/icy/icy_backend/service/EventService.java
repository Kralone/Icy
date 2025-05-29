package com.icy.icy_backend.service;

import com.icy.icy_backend.controller.dto.response.EventResponseDTO;
import com.icy.icy_backend.db.entity.Event;
import com.icy.icy_backend.db.entity.EventParticipation;
import com.icy.icy_backend.db.entity.EventType;
import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.db.repository.EventParticipationRepository;
import com.icy.icy_backend.db.repository.EventRepository;
import com.icy.icy_backend.db.repository.EventTypeRepository;
import com.icy.icy_backend.db.repository.UserRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.rest.AuthService;
import com.icy.icy_backend.service.rest.MessageService;
import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.websocket.EventWebSocketService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.crossstore.ChangeSetPersister;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class EventService {
    private static final Logger logger = LoggerFactory.getLogger(EventService.class);

    private final EventRepository eventRepository;
    private final MessageService messageService;
    private final EventWebSocketService eventWebSocketService;
    private final EventTypeRepository eventTypeRepository;
    private final EventParticipationRepository participationRepository;
    private final UserService userService;
    private final AuthService authService;

    public EventService(EventRepository eventRepository, MessageService messageService, EventWebSocketService eventWebSocketService, EventTypeRepository eventTypeRepository, EventParticipationRepository participationRepository, UserService userService, AuthService authService) {
        this.eventRepository = eventRepository;
        this.messageService = messageService;
        this.eventWebSocketService = eventWebSocketService;
        this.eventTypeRepository = eventTypeRepository;
        this.participationRepository = participationRepository;
        this.userService = userService;
        this.authService = authService;
    }

    public ResponseEntity<MessageResponse<EventResponseDTO>> createEvent(String type, String title, String description, LocalDateTime start, LocalDateTime end) {
        Event event = new Event();
        event.setType(getEventTypeByName(type));
        event.setTitle(title);
        event.setDescription(description);
        event.setStartDateTime(start);
        event.setEndDateTime(end);
        event.setFinished(false);
        Event saved = eventRepository.save(event);
        eventWebSocketService.sendEventUpdate(saved, "ADD");
        return messageService.buildResponse("event.created", new EventResponseDTO(saved));
    }

    public ResponseEntity<MessageResponse<EventResponseDTO>> updateEvent(UUID id, String type, String title, String description, LocalDateTime start, LocalDateTime end, boolean finished) {
        Event event = eventRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Event introuvable"));
        event.setType(getEventTypeByName(type));
        event.setTitle(title);
        event.setDescription(description);
        event.setStartDateTime(start);
        event.setEndDateTime(end);
        event.setFinished(finished);
        Event saved = eventRepository.save(event);
        eventWebSocketService.sendEventUpdate(saved, "UPDATE");
        return messageService.buildResponse("event.updated", new EventResponseDTO(saved));
    }

    public ResponseEntity<MessageResponse<Void>> deleteEvent(UUID id) {
        Event event = eventRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Event introuvable"));
        eventRepository.delete(event);
        eventWebSocketService.sendEventUpdate(event, "DELETE");
        return messageService.buildResponse("event.deleted", null);
    }

    public ResponseEntity<MessageResponse<List<EventResponseDTO>>> getAllEvents() {
        List<EventResponseDTO> events = ((List<Event>) eventRepository.findAll()).stream()
                .map(EventResponseDTO::new).collect(Collectors.toList());
        return messageService.buildResponse("event.list", events);
    }

    public List<EventResponseDTO> getAllEventsAsMap() {
        return ((List<Event>) eventRepository.findAll()).stream()
                .map(EventResponseDTO::new).collect(Collectors.toList());
    }


    /**
     * Trouve un utilisateur via son ID, ou lève une exception s'il n'existe pas.
     */
    public Event findEventById(UUID eventId) {
        return eventRepository.findById(eventId)
                .orElseThrow(() -> {
                    logger.warn("Event introuvable avec ID: {}", eventId);
                    return new ResourceNotFoundException("Event introuvable avec ID: " + eventId);
                });
    }


// ------------------------------Event Type Service--------------------------------------

    private EventType getEventTypeByName(String name) {
        if (name == null) {
            return new EventType();
        } else {
            try {
                return eventTypeRepository.findByName(name);
            } catch (Exception e) {
                logger.error("Error while getting event type by name: {}", name);
                return new EventType();
            }
        }
    }

    public ResponseEntity<MessageResponse<List<EventType>>> getAllEventsTypes() {
        return messageService.buildResponse("event.type.list", eventTypeRepository.findAll());
    }


// ------------------------------Event Type Service--------------------------------------

    public ResponseEntity<MessageResponse<Void>> setParticipation(UUID eventId, int status) {
        Event event = findEventById(eventId);

        User user = userService.findUserById(AuthUtils.getCurrentUserId());

        EventParticipation participation = participationRepository.findByEventAndUser(event, user)
                .orElse(new EventParticipation());

        participation.setEvent(event);
        participation.setUser(user);
        participation.setStatus(status);

        participationRepository.save(participation);

        return messageService.buildResponse("event.participation.set", null);
    }

    public ResponseEntity<MessageResponse<List<EventParticipation>>> getEventParticipations(UUID eventId) {

        Optional<List<EventParticipation>> participations = participationRepository.findAllByEvent(findEventById(eventId));
        if (participations.isPresent()) {

            return messageService.buildResponse("event.participation.get", participations.get());
        } else {
            throw new ResourceNotFoundException("Aucune participation enregistré pour cet event");
        }

    }

}