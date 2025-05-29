package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.dto.CreateEventRequest;
import com.icy.icy_backend.controller.dto.EventParticipationRequest;
import com.icy.icy_backend.controller.dto.UpdateEventRequest;
import com.icy.icy_backend.controller.dto.response.EventResponseDTO;
import com.icy.icy_backend.controller.dto.response.MessageResponse;
import com.icy.icy_backend.db.entity.EventParticipation;
import com.icy.icy_backend.db.entity.EventType;
import com.icy.icy_backend.service.EventService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/events")
public class EventController {
    private final EventService eventService;

    public EventController(EventService eventService) {
        this.eventService = eventService;
    }

    @PostMapping("/create")
    public ResponseEntity<MessageResponse<EventResponseDTO>> create(@RequestBody CreateEventRequest req) {
        return eventService.createEvent(req.getType(), req.getTitle(), req.getDescription(), req.getStartDateTime(), req.getEndDateTime());
    }

    @PutMapping("/update")
    public ResponseEntity<MessageResponse<EventResponseDTO>> update(@RequestBody UpdateEventRequest req) {
        return eventService.updateEvent(req.getId(), req.getType(), req.getTitle(), req.getDescription(), req.getStartDateTime(), req.getEndDateTime(), req.isFinished());
    }

    @DeleteMapping
    public ResponseEntity<MessageResponse<Void>> delete(@RequestParam UUID id) {
        return eventService.deleteEvent(id);
    }

    @GetMapping("/all")
    public ResponseEntity<MessageResponse<List<EventResponseDTO>>> all() {
        return eventService.getAllEvents();
    }

    @GetMapping("/types")
    public ResponseEntity<MessageResponse<List<EventType>>> getAllTypes() {
        return eventService.getAllEventsTypes();
    }

    @PostMapping( "/participation")
    public ResponseEntity<MessageResponse<Void>> setParticipation(@RequestBody EventParticipationRequest dto) {
        return eventService.setParticipation(dto.getEventId(), dto.getStatus());
    }

    @GetMapping("/participation")
    public ResponseEntity<MessageResponse<List<EventParticipation>>> getParticipation(@RequestParam UUID eventId) {
        return eventService.getEventParticipations(eventId);
    }
}