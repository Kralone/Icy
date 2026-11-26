package com.icy.icy_backend.controller.admin;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.front.OreLocationDTO;
import com.icy.icy_backend.service.universe.OreLocationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/ore-locations")
public class OreLocationAdminController {
    private final OreLocationService oreLocationService;

    public OreLocationAdminController(OreLocationService oreLocationService) {
        this.oreLocationService = oreLocationService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<List<OreLocationDTO>>> listLocations() {
        return oreLocationService.listLocations();
    }
}
