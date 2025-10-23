package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.dto.IceLinkBlockDTO;
import com.icy.icy_backend.service.IceLinkBlockService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/icelink/blocks")
@RequiredArgsConstructor
public class IceLinkBlockController {

    private final IceLinkBlockService service;

    @PostMapping
    public ResponseEntity<IceLinkBlockDTO> create(@RequestBody IceLinkBlockDTO dto) {
        return ResponseEntity.ok(service.create(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<IceLinkBlockDTO> update(@PathVariable Long id, @RequestBody IceLinkBlockDTO dto) {
        return ResponseEntity.ok(service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<IceLinkBlockDTO>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }
}
