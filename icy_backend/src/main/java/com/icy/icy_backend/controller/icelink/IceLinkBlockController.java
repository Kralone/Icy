package com.icy.icy_backend.controller.icelink;

import com.icy.icy_backend.controller.dto.icelink.IceLinkBlockDTO;
import com.icy.icy_backend.service.icelink.IceLinkBlockService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/icelink/blocks")
@RequiredArgsConstructor
public class IceLinkBlockController {

    private final IceLinkBlockService service;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<IceLinkBlockDTO> create(@RequestBody IceLinkBlockDTO dto) {
        return ResponseEntity.ok(service.create(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<IceLinkBlockDTO> update(@PathVariable Long id, @RequestBody IceLinkBlockDTO dto) {
        return ResponseEntity.ok(service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<IceLinkBlockDTO>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }
}




