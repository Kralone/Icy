package com.icy.icy_backend.controller.admin;

import com.icy.icy_backend.controller.dto.request.admin.PlanetUpsertRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.front.CelestialBodyDTO;
import com.icy.icy_backend.service.universe.CelestialBodyService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/planets")
public class CelestialBodyAdminController {
    private final CelestialBodyService celestialBodyService;

    public CelestialBodyAdminController(CelestialBodyService celestialBodyService) {
        this.celestialBodyService = celestialBodyService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<List<CelestialBodyDTO>>> listBodies() {
        return celestialBodyService.listAdminBodies();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<CelestialBodyDTO>> createBody(@RequestBody PlanetUpsertRequest request) {
        return celestialBodyService.createBody(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<CelestialBodyDTO>> updateBody(
            @PathVariable Long id,
            @RequestBody PlanetUpsertRequest request
    ) {
        return celestialBodyService.updateBody(id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<String>> deleteBody(@PathVariable Long id) {
        return celestialBodyService.deleteBody(id);
    }
}
