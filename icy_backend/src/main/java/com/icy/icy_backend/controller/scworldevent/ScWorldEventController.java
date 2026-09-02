package com.icy.icy_backend.controller.scworldevent;

import com.icy.icy_backend.controller.dto.scworldevent.CreateScWorldEventDTO;
import com.icy.icy_backend.controller.dto.scworldevent.UpdateScWorldEventDTO;
import com.icy.icy_backend.controller.dto.response.scworldevent.ScWorldEventDTO;
import com.icy.icy_backend.service.scworldevent.ScWorldEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/sc-world-events")
@RequiredArgsConstructor
public class ScWorldEventController {

    private final ScWorldEventService service;

    /**
     * ✅ 1. ROUTE ADMIN (GET /api/sc-world-events)
     * Récupère TOUT l'historique (trié par date DESC).
     */
    @GetMapping
    public ResponseEntity<Page<ScWorldEventDTO>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size
    ) {
        return ResponseEntity.ok(service.getAll(page, size).map(ScWorldEventDTO::from));
    }

    /**
     * ✅ 2. ROUTE JOUEUR (GET /api/sc-world-events/playable)
     * Récupère les événements ACTIFS ou FUTURS.
     */
    @GetMapping("/playable")
    public ResponseEntity<Page<ScWorldEventDTO>> getPlayable(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size
    ) {
        return ResponseEntity.ok(service.getPlayable(page, size).map(ScWorldEventDTO::from));
    }

    @GetMapping("/history")
    public ResponseEntity<Page<ScWorldEventDTO>> getHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size
    ) {
        return ResponseEntity.ok(service.getHistory(page, size).map(ScWorldEventDTO::from));
    }

    /**
     * ✅ 3. ROUTE CURRENT (GET /api/sc-world-events/current)
     * Récupère l'événement "Principal" en cours (s'il existe).
     */
    @GetMapping("/current")
    public ResponseEntity<ScWorldEventDTO> current() {
        return service.getCurrentOptional()
                .map(e -> ResponseEntity.ok(ScWorldEventDTO.from(e)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/current/exists")
    public ResponseEntity<Boolean> hasCurrentEvent() {
        return ResponseEntity.ok(service.hasCurrentEvent());
    }

    /**
     * ✅ 4. ROUTE DETAIL (GET /api/sc-world-events/{id})
     * Attention : Spring teste cette route en dernier.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ScWorldEventDTO> getOne(@PathVariable UUID id) {
        return ResponseEntity.ok(ScWorldEventDTO.from(service.getByIdOrThrow(id)));
    }

    // --- ÉCRITURE (ADMIN) ---

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ScWorldEventDTO> create(@RequestBody CreateScWorldEventDTO dto) {
        return ResponseEntity.ok(ScWorldEventDTO.from(service.create(dto)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ScWorldEventDTO> update(@PathVariable UUID id, @RequestBody UpdateScWorldEventDTO dto) {
        return ResponseEntity.ok(ScWorldEventDTO.from(service.update(id, dto)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.ok().build();
    }
}

