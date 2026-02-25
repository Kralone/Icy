package com.icy.icy_backend.controller.admin;

import com.icy.icy_backend.controller.dto.request.admin.StationUpsertRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.front.OrbitalStationDTO;
import com.icy.icy_backend.service.universe.OrbitalStationService;
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
@RequestMapping("/api/admin/stations")
public class OrbitalStationAdminController {
    private final OrbitalStationService orbitalStationService;

    public OrbitalStationAdminController(OrbitalStationService orbitalStationService) {
        this.orbitalStationService = orbitalStationService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<List<OrbitalStationDTO>>> listStations() {
        return orbitalStationService.listAdminStations();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<OrbitalStationDTO>> createStation(@RequestBody StationUpsertRequest request) {
        return orbitalStationService.createStation(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<OrbitalStationDTO>> updateStation(
            @PathVariable Long id,
            @RequestBody StationUpsertRequest request
    ) {
        return orbitalStationService.updateStation(id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<String>> deleteStation(@PathVariable Long id) {
        return orbitalStationService.deleteStation(id);
    }
}
