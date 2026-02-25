package com.icy.icy_backend.service.event;

import com.icy.icy_backend.controller.dto.response.event.EventResponseDTO;
import com.icy.icy_backend.db.entity.event.Event;
import com.icy.icy_backend.db.entity.event.EventParticipation;
import com.icy.icy_backend.db.entity.event.EventType;
import com.icy.icy_backend.db.entity.user.User;
import com.icy.icy_backend.db.repository.event.EventParticipationRepository;
import com.icy.icy_backend.db.repository.event.EventRepository;
import com.icy.icy_backend.db.repository.event.EventTypeRepository;
import com.icy.icy_backend.db.repository.user.UserRepository;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.messaging.EventPublisher;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.auth.AuthService;
import com.icy.icy_backend.service.common.MessageService;
import com.icy.icy_backend.service.user.UserService;
import com.icy.icy_backend.service.notification.NotificationPushService;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.websocket.EventWebSocketService;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.data.crossstore.ChangeSetPersister;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.context.event.EventListener;


@Slf4j
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
    private final NotificationPushService notificationPushService;

    public EventService(EventRepository eventRepository, MessageService messageService, EventWebSocketService eventWebSocketService, EventTypeRepository eventTypeRepository, EventParticipationRepository participationRepository, UserService userService, AuthService authService, EventPublisher eventPublisher, NotificationPushService notificationPushService) {
        this.eventRepository = eventRepository;
        this.messageService = messageService;
        this.eventWebSocketService = eventWebSocketService;
        this.eventTypeRepository = eventTypeRepository;
        this.participationRepository = participationRepository;
        this.userService = userService;
        this.authService = authService;
        this.eventPublisher = eventPublisher;
        this.notificationPushService = notificationPushService;
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
        notificationPushService.sendBroadcast(
                "Evenement : cree",
                saved.getTitle() + " est disponible.",
                "/icy/events",
                2
        );

        return messageService.buildResponse("event.created", new EventResponseDTO(saved));
    }


    @Transactional
    public ResponseEntity<MessageResponse<EventResponseDTO>> updateEvent(
            UUID id,
            String type,
            String title,
            String description,
            LocalDateTime start,
            LocalDateTime end,
            boolean finished
    ) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Event introuvable"));

        // --- Détecter changement de date AVANT d'écrire les nouvelles valeurs
        LocalDateTime oldStart = event.getStartDateTime();
        LocalDateTime oldEnd = event.getEndDateTime();
        boolean wasFinished = event.isFinished();

        boolean dateChanged = !Objects.equals(oldStart, start) || !Objects.equals(oldEnd, end);

        // --- Mise à jour event
        event.setType(getEventTypeByName(type));
        event.setTitle(title);
        event.setDescription(description);
        event.setStartDateTime(start);
        event.setEndDateTime(end);
        event.setFinished(finished);
        event.setUpdatedAt(LocalDateTime.now());

        // --- Si date changée : on purge les participations
        if (dateChanged) {
            logger.info("Date modifiée pour event {} ({}->{} / {}->{}). Suppression des participations.",
                    event.getId(), oldStart, start, oldEnd, end);

            participationRepository.deleteAllByEvent(event);
        }

        Event saved = eventRepository.save(event);

        // --- Realtime + Rabbit
        eventWebSocketService.sendEventUpdate(saved, "UPDATE");
        eventPublisher.publishEventUpdated(saved);
        if (!wasFinished && finished) {
            eventPublisher.publishEventEnded(saved);
        }
        if (dateChanged) {
            notificationPushService.sendBroadcast(
                    "Evenement : mis a jour",
                    saved.getTitle() + " a ete mis a jour.",
                    "/icy/events",
                    2
            );
            List<EventParticipation> participations = participationRepository.findAllByEvent(saved).orElse(List.of());
            List<UUID> participantIds = participations.stream()
                    .map(EventParticipation::getUser)
                    .filter(Objects::nonNull)
                    .map(User::getId)
                    .distinct()
                    .toList();
            if (!participantIds.isEmpty()) {
                notificationPushService.sendToUsers(
                        participantIds,
                        "Evenement : mis a jour",
                        saved.getTitle() + " a ete mis a jour.",
                        "/icy/events",
                        2
                );
            }
        }

        return messageService.buildResponse("event.updated", new EventResponseDTO(saved));
    }


    public ResponseEntity<MessageResponse<Void>> deleteEvent(UUID id) {
        Event event = eventRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Event introuvable"));
        List<EventParticipation> participations = participationRepository.findAllByEvent(event).orElse(List.of());
        List<UUID> participantIds = participations.stream()
                .map(EventParticipation::getUser)
                .filter(Objects::nonNull)
                .map(User::getId)
                .distinct()
                .toList();
        eventRepository.delete(event);
        eventWebSocketService.sendEventUpdate(event, "DELETE");
        eventPublisher.publishEventDeleted(event);
        notificationPushService.sendBroadcast(
                "Evenement : supprime",
                event.getTitle() + " a ete supprime.",
                "/icy/events",
                2
        );
        if (!participantIds.isEmpty()) {
            notificationPushService.sendToUsers(
                    participantIds,
                    "Evenement : supprime",
                    event.getTitle() + " a ete supprime.",
                    "/icy/events",
                    2
            );
        }
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

    public ResponseEntity<MessageResponse<List<EventResponseDTO>>> getRecentFinishedEvents() {
        List<EventResponseDTO> events = eventRepository.findTop3ByFinishedTrueOrderByEndDateTimeDesc().stream()
                .map(EventResponseDTO::new)
                .toList();
        return messageService.buildResponse("event.list", events);
    }


    public List<Event> getEventsBetween(LocalDate start, LocalDate end) {
        LocalDateTime startDateTime = start.atStartOfDay();
        LocalDateTime endDateTime = end.atTime(LocalTime.MAX);

        List<Event> events = eventRepository.findByStartDateTimeBetweenOrderByStartDateTimeAsc(startDateTime, endDateTime);
        logger.info("Récupération de {} événements entre {} et {}", events.size(), startDateTime, endDateTime);

        return events;
    }


    @Transactional
    @Scheduled(cron = "0 */5 * * * *", zone = "Europe/Paris")
    public void markExpiredEventsAsFinished() {
        ZoneId parisZone = ZoneId.of("Europe/Paris");
        LocalDateTime nowInParis = LocalDateTime.now(parisZone);

        List<Event> eventsToFinish = eventRepository
                .findByEndDateTimeBeforeAndFinishedFalse(nowInParis);

        if (eventsToFinish.isEmpty()) {
            logger.info("Aucun événement à terminer avant {}", nowInParis);
            return;
        }

        for (Event event : eventsToFinish) {
            event.setFinished(true);
            event.setUpdatedAt(LocalDateTime.now());
            logger.info("Événement terminé automatiquement : {}", event.getId());
        }

        Iterable<Event> savedEvents = eventRepository.saveAll(eventsToFinish);
        int updatedCount = 0;
        for (Event event : savedEvents) {
            updatedCount++;
            eventWebSocketService.sendEventUpdate(event, "UPDATE");

            try {
                eventPublisher.publishEventEnded(event);
                logger.info("Message RabbitMQ envoyé pour la fin de l'événement {}", event.getId());
            } catch (Exception e) {
                logger.error("Erreur lors de l'envoi RabbitMQ pour l'événement {} : {}", event.getId(), e.getMessage());
            }
        }

        logger.info("{} événements marqués comme terminés avant {}", updatedCount, nowInParis);
    }

    @Scheduled(cron = "0 0 12 * * *", zone = "Europe/Paris")
    public void sendDailyPing() {
        LocalDate today = LocalDate.now(ZoneId.of("Europe/Paris"));
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

        List<Event> todaysEvents = eventRepository.findAllBetween(startOfDay, endOfDay);

        if (todaysEvents.isEmpty()) {
            log.info("📭 Aucun événement prévu aujourd’hui — pas de ping global.");
            return;
        }

        log.info("📢 Ping global programmé à 12h pour {} événement(s).", todaysEvents.size());

        Map<String, Object> payload = new HashMap<>();
        payload.put("date", today.toString());
        payload.put("events", todaysEvents.stream()
                .map(e -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", e.getId());
                    map.put("title", e.getTitle());
                    map.put("date", e.getStartDateTime() != null ? e.getStartDateTime().toString() : null);
                    return map;
                })
                .collect(Collectors.toList()));

        eventPublisher.sendGeneric("events.dailyPing", payload);
    }


    /**
     * ⏰ Toutes les 15 minutes : ping 1h avant chaque événement à venir.
     */
    @Transactional(readOnly = true)
    @Scheduled(cron = "0 0/15 * * * *", zone = "Europe/Paris")
    public void sendOneHourReminder() {
        log.info("✅ [Startup] One hour event reminder ping");
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Europe/Paris"));
        ZonedDateTime from = now.plusMinutes(50);
        ZonedDateTime to = now.plusMinutes(70);

        List<Event> upcomingEvents = eventRepository.findAllBetween(from.toLocalDateTime(), to.toLocalDateTime());

        if (upcomingEvents.isEmpty()) {
            return;
        }

        for (Event event : upcomingEvents) {
            List<EventParticipation> participations = participationRepository.findAllByEvent(event).orElse(List.of());
            List<Map<String, Object>> participants = participations.stream()
                    .filter(p -> p.getStatus() >= 0) // 0 = peut-être, 1 = confirmé
                    .map(p -> {
                        Map<String, Object> map = new HashMap<>();
                        map.put("username", p.getUser().getUsername());
                        map.put("status", p.getStatus());
                        map.put("discordId", p.getUser().getDiscordId());
                        return map;
                    })
                    .collect(Collectors.toList());

            Map<String, Object> payload = new HashMap<>();
            payload.put("eventId", event.getId());
            payload.put("title", event.getTitle());
            payload.put("date", event.getStartDateTime().toString());
            payload.put("participants", participants);

            log.info("⏰ Rappel 1h avant envoyé pour l’événement {}", event.getTitle());
            eventPublisher.sendGeneric("events.reminderOneHour", payload);

            List<UUID> participantIds = participations.stream()
                    .map(EventParticipation::getUser)
                    .filter(Objects::nonNull)
                    .map(User::getId)
                    .distinct()
                    .toList();
            if (!participantIds.isEmpty()) {
                notificationPushService.sendToUsers(
                        participantIds,
                        "Evenement : rappel",
                        event.getTitle() + " commence dans 1h.",
                        "/icy/events",
                        3
                );
            }
        }
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

    public ResponseEntity<MessageResponse<EventType>> createEventType(
            String name,
            String textColor,
            String backgroundColor,
            String imageUrl
    ) {
        if (eventTypeRepository.existsById(name)) {
            logger.warn("Tentative de création d’un type d’événement existant : {}", name);
            throw new ResourceAlreadyExistsException("Le type d’événement existe déjà : " + name);
        }

        EventType newType = new EventType();
        newType.setName(name);
        newType.setTextColor(textColor);
        newType.setBackgroundColor(backgroundColor); // ✅ FIX ICI
        newType.setImageUrl(imageUrl);

        EventType saved = eventTypeRepository.save(newType);
        logger.info("Type d’événement créé : {}", saved.getName());
        return messageService.buildResponse("event.type.created", saved);
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


    public ResponseEntity<MessageResponse<Void>> deleteEventType(String name) {
        if (!eventTypeRepository.existsById(name)) {
            logger.warn("Tentative de suppression d’un type d’événement inexistant : {}", name);
            throw new ResourceNotFoundException("Type d’événement introuvable : " + name);
        }

        eventTypeRepository.deleteById(name);
        logger.info("Type d’événement supprimé : {}", name);
        return messageService.buildResponse("event.type.deleted", null);
    }


    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void runScheduledTasksAtStartup() {
        log.info("🚀 [Startup] Exécution initiale des tâches planifiées...");

        try {
            markExpiredEventsAsFinished();
            sendOneHourReminder();

            log.info("✅ [Startup] Tâches planifiées exécutées avec succès au démarrage.");
        } catch (Exception e) {
            log.error("❌ [Startup] Erreur lors de l’exécution des tâches planifiées : {}", e.getMessage(), e);
        }
    }

}





