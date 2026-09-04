package com.icy.icy_backend.controller.admin;

import com.icy.icy_backend.controller.dto.request.admin.CatalogMapRequest;
import com.icy.icy_backend.controller.dto.response.admin.CatalogSyncRunDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.service.catalog.CatalogSyncService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/catalog-sync")
@PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
public class CatalogSyncAdminController {
    private final CatalogSyncService catalogSyncService;

    public CatalogSyncAdminController(CatalogSyncService catalogSyncService) {
        this.catalogSyncService = catalogSyncService;
    }

    @PostMapping("/scrape-all")
    public ResponseEntity<MessageResponse<CatalogSyncRunDTO>> scrapeAll() {
        return catalogSyncService.startScrapeAll();
    }

    @PostMapping("/scrape-and-map")
    public ResponseEntity<MessageResponse<CatalogSyncRunDTO>> scrapeAndMap(@RequestBody CatalogMapRequest request) {
        return catalogSyncService.startScrapeAndMap(request == null ? null : request.scope());
    }

    @GetMapping("/current")
    public ResponseEntity<MessageResponse<CatalogSyncRunDTO>> current() {
        return catalogSyncService.current();
    }
}
