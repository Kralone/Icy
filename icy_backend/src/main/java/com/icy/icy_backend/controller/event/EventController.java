package com.icy.icy_backend.controller.event;

import com.icy.icy_backend.controller.dto.event.CreateEventRequest;
import com.icy.icy_backend.controller.dto.event.EventParticipationRequest;
import com.icy.icy_backend.controller.dto.event.UpdateEventRequest;
import com.icy.icy_backend.controller.dto.response.event.EventResponseDTO;
import com.icy.icy_backend.controller.dto.response.event.EventParticipationResponseDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.event.EventType;
import com.icy.icy_backend.service.event.EventService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/events")
public class EventController {
    private final EventService eventService;
    private final com.icy.icy_backend.service.pole.PoleAccess poleAccess;

    public EventController(EventService eventService, com.icy.icy_backend.service.pole.PoleAccess poleAccess) {
        this.eventService = eventService;
        this.poleAccess = poleAccess;
    }

    @PreAuthorize("@poleAccess.canCreate()")
    @PostMapping("/create")
    public ResponseEntity<MessageResponse<EventResponseDTO>> create(@RequestBody CreateEventRequest req) {
        // Le pôle est contrôlé avant la création : un pôle inconnu ne laisse pas d'événement derrière lui.
        com.icy.icy_backend.db.entity.user.Specialty pole = com.icy.icy_backend.db.entity.user.Specialty.optional(poleAccess.poleFor(req.getPole()));
        // Le pôle est enregistré avec l'événement : la diffusion temps réel le porte déjà.
        return eventService.createEvent(req.getType(), req.getTitle(), req.getDescription(), req.getStartDateTime(), req.getEndDateTime(), true, pole);
    }

    @PreAuthorize("@poleAccess.manages(#req.id)")
    @PutMapping("/update")
    public ResponseEntity<MessageResponse<EventResponseDTO>> update(@RequestBody UpdateEventRequest req) {
        com.icy.icy_backend.db.entity.user.Specialty pole = com.icy.icy_backend.db.entity.user.Specialty.optional(poleAccess.poleFor(req.getPole()));
        return eventService.updateEvent(req.getId(), req.getType(), req.getTitle(), req.getDescription(), req.getStartDateTime(), req.getEndDateTime(), req.isFinished(),
                Boolean.TRUE.equals(req.getKeepParticipants()), java.util.Optional.ofNullable(pole));
    }

    @PreAuthorize("@poleAccess.manages(#id)")
    @DeleteMapping
    public ResponseEntity<MessageResponse<Void>> delete(@RequestParam UUID id) {
        return eventService.deleteEvent(id);
    }

    @GetMapping("/all")
    public ResponseEntity<MessageResponse<List<EventResponseDTO>>> all(@RequestParam(defaultValue = "false") boolean includeDrafts) {
        return eventService.getAllEvents(includeDrafts);
    }

    @GetMapping("/types")
    public ResponseEntity<MessageResponse<List<EventType>>> getAllTypes() {
        return eventService.getAllEventsTypes();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PostMapping("/types")
    public ResponseEntity<MessageResponse<EventType>> createType(@RequestBody EventType type) {
        return eventService.createEventType(
                type.getName(),
                type.getTextColor(),
                type.getBackgroundColor(),
                type.getImageUrl()
        );
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @DeleteMapping("/types/{name}")
    public ResponseEntity<MessageResponse<Void>> deleteType(@PathVariable String name) {
        return eventService.deleteEventType(name);
    }

    @PostMapping( "/participation")
    public ResponseEntity<MessageResponse<Void>> setParticipation(@RequestBody EventParticipationRequest dto) {
        return eventService.setParticipation(dto.getEventId(), dto.getStatus());
    }

    @GetMapping("/participation")
    public ResponseEntity<MessageResponse<List<EventParticipationResponseDTO>>> getParticipation(@RequestParam UUID eventId) {
        return eventService.getEventParticipations(eventId);
    }

    @GetMapping("/upcoming")
    public ResponseEntity<MessageResponse<List<EventResponseDTO>>> getUpcomingEvents() {
        return eventService.getUpcomingEvents();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PutMapping("/types/{name}")
    public ResponseEntity<MessageResponse<EventType>> updateType(@PathVariable String name, @RequestBody EventType updatedType) {
        return eventService.updateEventType(name, updatedType);
    }


}





