package com.icy.icy_backend.controller.admin;

import com.icy.icy_backend.controller.dto.request.admin.CatalogMapRequest;
import com.icy.icy_backend.controller.dto.request.admin.CatalogConflictResolutionRequest;
import com.icy.icy_backend.controller.dto.response.admin.CatalogConflictDTO;
import com.icy.icy_backend.controller.dto.response.admin.CatalogSyncRunDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.service.catalog.CatalogSyncService;
import com.icy.icy_backend.service.catalog.CatalogConflictService;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/catalog-sync")
@PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
public class CatalogSyncAdminController {
    private final CatalogSyncService catalogSyncService;
    private final CatalogConflictService conflictService;
    private final MessageService messageService;

    public CatalogSyncAdminController(
            CatalogSyncService catalogSyncService,
            CatalogConflictService conflictService,
            MessageService messageService
    ) {
        this.catalogSyncService = catalogSyncService;
        this.conflictService = conflictService;
        this.messageService = messageService;
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

    @GetMapping("/conflicts")
    public ResponseEntity<MessageResponse<List<CatalogConflictDTO>>> conflicts(@RequestParam long runId) {
        List<CatalogConflictDTO> conflicts = conflictService.pendingForRun(runId);
        return messageService.buildResponse("catalog.sync.conflicts", conflicts, conflicts.size());
    }

    @PostMapping("/conflicts/{conflictId}/resolve")
    public ResponseEntity<MessageResponse<CatalogSyncRunDTO>> resolve(
            @PathVariable long conflictId,
            @RequestBody CatalogConflictResolutionRequest request
    ) {
        CatalogConflictService.Resolution resolution = conflictService.resolve(
                conflictId, request == null ? null : request.selection()
        );
        if (resolution.remainingConflicts() == 0) {
            catalogSyncService.resumeAfterReview(resolution.runId());
        }
        return catalogSyncService.current();
    }
}
