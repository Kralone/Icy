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
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.messaging.EventPublisher;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.rest.AuthService;
import com.icy.icy_backend.service.rest.MessageService;
import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.websocket.EventWebSocketService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.crossstore.ChangeSetPersister;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
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
    private final EventPublisher eventPublisher;

    public EventService(EventRepository eventRepository, MessageService messageService, EventWebSocketService eventWebSocketService, EventTypeRepository eventTypeRepository, EventParticipationRepository participationRepository, UserService userService, AuthService authService, EventPublisher eventPublisher) {
        this.eventRepository = eventRepository;
        this.messageService = messageService;
        this.eventWebSocketService = eventWebSocketService;
        this.eventTypeRepository = eventTypeRepository;
        this.participationRepository = participationRepository;
        this.userService = userService;
        this.authService = authService;
        this.eventPublisher = eventPublisher;
    }

    public ResponseEntity<MessageResponse<EventResponseDTO>> createEvent(
            String type,
            String title,
            String description,
            LocalDateTime start,
            LocalDateTime end
    ) {
        // 🔹 Récupération du créateur (user connecté)
        UUID userId = AuthUtils.getCurrentUserId();
        User creator = userService.findUserById(userId);
        if (creator == null) {
            logger.warn("Impossible d’associer un créateur à l’événement — utilisateur introuvable (ID={})", userId);
        }

        // 🔹 Création de l’événement
        Event event = new Event();
        event.setType(getEventTypeByName(type));
        event.setTitle(title);
        event.setDescription(description);
        event.setStartDateTime(start);
        event.setEndDateTime(end);
        event.setFinished(false);
        event.setCreatedAt(LocalDateTime.now());
        event.setUpdatedAt(LocalDateTime.now());
        event.setCreator(creator); // ✅ Important

        // 🔹 Persistance
        Event saved = eventRepository.save(event);

        // 🔹 Diffusion temps réel + message RabbitMQ
        eventWebSocketService.sendEventUpdate(saved, "ADD");
        eventPublisher.publishEventCreated(saved);

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
        eventPublisher.publishEventUpdated(saved);
        return messageService.buildResponse("event.updated", new EventResponseDTO(saved));
    }

    public ResponseEntity<MessageResponse<Void>> deleteEvent(UUID id) {
        Event event = eventRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Event introuvable"));
        eventRepository.delete(event);
        eventWebSocketService.sendEventUpdate(event, "DELETE");
        eventPublisher.publishEventDeleted(event);
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

    public ResponseEntity<MessageResponse<List<Event>>> getUpcomingEvents() {
        return messageService.buildResponse("event.upcoming", eventRepository.findByStartDateTimeAfterOrderByStartDateTimeAsc(LocalDateTime.now()));
    }


    public List<Event> getEventsBetween(LocalDate start, LocalDate end) {
        LocalDateTime startDateTime = start.atStartOfDay();
        LocalDateTime endDateTime = end.atTime(LocalTime.MAX);

        List<Event> events = eventRepository.findByStartDateTimeBetweenOrderByStartDateTimeAsc(startDateTime, endDateTime);
        logger.info("Récupération de {} événements entre {} et {}", events.size(), startDateTime, endDateTime);

        return events;
    }


    @Transactional
    @Scheduled(cron = "0 1 0 * * *")
    public void markPastDayEventsAsFinished() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        LocalDateTime startOfYesterday = yesterday.atStartOfDay();
        LocalDateTime endOfYesterday = yesterday.atTime(LocalTime.MAX);

        List<Event> eventsToFinish = eventRepository
                .findByEndDateTimeBetweenAndFinishedFalse(startOfYesterday, endOfYesterday);

        if (eventsToFinish.isEmpty()) {
            logger.info("Aucun événement à terminer pour {}", yesterday);
            return;
        }

        for (Event event : eventsToFinish) {
            event.setFinished(true);
            logger.info("Événement terminé automatiquement : {}", event.getId());
            eventWebSocketService.sendEventUpdate(event, "UPDATE");
        }

        eventRepository.saveAll(eventsToFinish);
        logger.info("{} événements marqués comme terminés pour {}", eventsToFinish.size(), yesterday);
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

    public ResponseEntity<MessageResponse<Void>> setParticipation(UUID eventId, int status) {
        Event event = findEventById(eventId);

        User user = userService.findUserById(AuthUtils.getCurrentUserId());

        EventParticipation participation = participationRepository.findByEventAndUser(event, user)
                .orElse(new EventParticipation());

        participation.setEvent(event);
        participation.setUser(user);
        participation.setStatus(status);

        participationRepository.save(participation);

        eventPublisher.publishEventUpdated(event);

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

// -----------------------------
// Types d'événements
// -----------------------------


    public ResponseEntity<MessageResponse<List<EventType>>> getAllEventsTypes() {
        return messageService.buildResponse("event.type.list", eventTypeRepository.findAll());
    }

    public ResponseEntity<MessageResponse<EventType>> createEventType(String name, String textColor, String imageUrl) {
        if (eventTypeRepository.existsById(name)) {
            logger.warn("Tentative de création d’un type d’événement existant : {}", name);
            throw new ResourceAlreadyExistsException("Le type d’événement existe déjà : " + name);
        }

        EventType newType = new EventType();
        newType.setName(name);
        newType.setTextColor(textColor);
        newType.setImageUrl(imageUrl);

        EventType saved = eventTypeRepository.save(newType);
        logger.info("Type d’événement créé : {}", saved.getName());
        return messageService.buildResponse("event.type.created", saved);
    }

    public ResponseEntity<MessageResponse<Void>> deleteEventType(String name) {
        if (!eventTypeRepository.existsById(name)) {
            logger.warn("Tentative de suppression d’un type d’événement inexistant : {}", name);
            throw new ResourceNotFoundException("Type d’événement introuvable : " + name);
        }

        eventTypeRepository.deleteById(name);
        logger.info("Type d’événement supprimé : {}", name);
        return messageService.buildResponse("event.type.deleted", null);
    }

    public ResponseEntity<MessageResponse<EventType>> updateEventType(String name, EventType updatedType) {
        EventType existing = eventTypeRepository.findById(name)
                .orElseThrow(() -> new ResourceNotFoundException("Type d’événement introuvable : " + name));

        existing.setTextColor(updatedType.getTextColor());
        existing.setImageUrl(updatedType.getImageUrl());
        existing.setBackgroundColor(updatedType.getBackgroundColor());


        // Si on veut aussi pouvoir renommer :
        if (updatedType.getName() != null && !updatedType.getName().equals(name)) {
            eventTypeRepository.deleteById(name);
            existing.setName(updatedType.getName());

        }

        EventType saved = eventTypeRepository.save(existing);
        logger.info("Type d’événement mis à jour : {}", saved.getName());
        return messageService.buildResponse("event.type.updated", saved);
    }


}