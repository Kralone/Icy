package com.icy.icy_backend.controller.event;

import com.icy.icy_backend.controller.dto.event.CreateEventRequest;
import com.icy.icy_backend.controller.dto.event.EventParticipationRequest;
import com.icy.icy_backend.controller.dto.event.UpdateEventRequest;
import com.icy.icy_backend.controller.dto.response.event.EventResponseDTO;
import com.icy.icy_backend.controller.dto.response.event.EventParticipationResponseDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.event.EventTypeRequest;
import com.icy.icy_backend.controller.dto.response.event.EventTypeResponseDTO;
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
        java.util.EnumSet<com.icy.icy_backend.db.entity.user.Specialty> poles = poleAccess.polesFor(req.requestedPoles());
        // Le pôle est enregistré avec l'événement : la diffusion temps réel le porte déjà.
        return eventService.createEvent(req.getType(), req.getTitle(), req.getDescription(), req.getStartDateTime(), req.getEndDateTime(), true, poles);
    }

    @PreAuthorize("@poleAccess.manages(#req.id)")
    @PutMapping("/update")
    public ResponseEntity<MessageResponse<EventResponseDTO>> update(@RequestBody UpdateEventRequest req) {
        java.util.EnumSet<com.icy.icy_backend.db.entity.user.Specialty> poles = poleAccess.polesFor(req.requestedPoles());
        return eventService.updateEvent(req.getId(), req.getType(), req.getTitle(), req.getDescription(), req.getStartDateTime(), req.getEndDateTime(), req.isFinished(),
                Boolean.TRUE.equals(req.getKeepParticipants()), poles);
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
    public ResponseEntity<MessageResponse<List<EventTypeResponseDTO>>> getAllTypes() {
        return eventService.getAllEventsTypes();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PostMapping("/types")
    public ResponseEntity<MessageResponse<EventTypeResponseDTO>> createType(@RequestBody EventTypeRequest type) {
        return eventService.createEventType(type);
    }

    /** Refusé (409) si des activités utilisent encore ce type : il faut alors l'archiver. */
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @DeleteMapping("/types/{name}")
    public ResponseEntity<MessageResponse<Void>> deleteType(@PathVariable String name) {
        return eventService.deleteEventType(name);
    }

    /** Archive ({@code true}) ou restaure ({@code false}) un type. */
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PutMapping("/types/{name}/archived")
    public ResponseEntity<MessageResponse<EventTypeResponseDTO>> setTypeArchived(@PathVariable String name, @RequestParam boolean archived) {
        return eventService.setEventTypeArchived(name, archived);
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
    public ResponseEntity<MessageResponse<EventTypeResponseDTO>> updateType(@PathVariable String name, @RequestBody EventTypeRequest updatedType) {
        return eventService.updateEventType(name, updatedType);
    }


}





