package com.icy.icy_backend.controller.scworldevent;

import com.icy.icy_backend.controller.dto.scworldevent.CreateScWorldEventTypeDTO;
import com.icy.icy_backend.controller.dto.scworldevent.UpdateScWorldEventTypeDTO;
import com.icy.icy_backend.controller.dto.response.scworldevent.ScWorldEventTypeDTO;
import com.icy.icy_backend.service.scworldevent.ScWorldEventTypeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sc-world-event-types")
@RequiredArgsConstructor
public class ScWorldEventTypeController {

    private final ScWorldEventTypeService service;

    @GetMapping
    public ResponseEntity<List<ScWorldEventTypeDTO>> getAll() {
        return ResponseEntity.ok(
                service.getAll().stream().map(ScWorldEventTypeDTO::from).toList()
        );
    }

    @GetMapping("/{name}")
    public ResponseEntity<ScWorldEventTypeDTO> getOne(@PathVariable String name) {
        return ResponseEntity.ok(ScWorldEventTypeDTO.from(service.getByNameOrThrow(name)));
    }

    @PostMapping
    public ResponseEntity<ScWorldEventTypeDTO> create(@RequestBody CreateScWorldEventTypeDTO dto) {
        return ResponseEntity.ok(ScWorldEventTypeDTO.from(service.create(dto)));
    }

    @PutMapping("/{name}")
    public ResponseEntity<ScWorldEventTypeDTO> update(@PathVariable String name, @RequestBody UpdateScWorldEventTypeDTO dto) {
        return ResponseEntity.ok(ScWorldEventTypeDTO.from(service.update(name, dto)));
    }

    @DeleteMapping("/{name}")
    public ResponseEntity<Void> delete(@PathVariable String name) {
        service.delete(name);
        return ResponseEntity.ok().build();
    }
}


