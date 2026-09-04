package com.icy.icy_backend.service.catalog;

import com.icy.icy_backend.controller.dto.response.admin.CatalogSyncRunDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.catalog.CatalogSyncRun;
import com.icy.icy_backend.db.repository.catalog.CatalogSyncRunRepository;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CatalogSyncService {
    private static final List<String> ACTIVE_STATUSES = List.of("QUEUED", "RUNNING");

    private final CatalogSyncRunRepository runRepository;
    private final CatalogSyncWorker worker;
    private final MessageService messageService;

    public CatalogSyncService(
            CatalogSyncRunRepository runRepository,
            CatalogSyncWorker worker,
            MessageService messageService
    ) {
        this.runRepository = runRepository;
        this.worker = worker;
        this.messageService = messageService;
    }

    public ResponseEntity<MessageResponse<CatalogSyncRunDTO>> startScrapeAll() {
        return start("SCRAPE_ALL", null);
    }

    public ResponseEntity<MessageResponse<CatalogSyncRunDTO>> startScrapeAndMap(String rawScope) {
        return start("SCRAPE_AND_MAP", CatalogSyncScope.parse(rawScope));
    }

    public ResponseEntity<MessageResponse<CatalogSyncRunDTO>> current() {
        CatalogSyncRun run = runRepository.findFirstByOrderByCreatedAtDesc().orElse(null);
        return messageService.buildResponse("catalog.sync.current", run == null ? null : new CatalogSyncRunDTO(run));
    }

    private ResponseEntity<MessageResponse<CatalogSyncRunDTO>> start(String operation, CatalogSyncScope scope) {
        if (runRepository.existsByStatusIn(ACTIVE_STATUSES)) {
            throw new ResourceAlreadyExistsException("Un scrape catalogue est deja en cours.");
        }

        CatalogSyncRun run = new CatalogSyncRun();
        run.setOperation(operation);
        run.setScope(scope == null ? null : scope.name());
        run.setStatus("QUEUED");
        run.setMessage("Traitement place dans la file");
        try {
            run = runRepository.saveAndFlush(run);
        } catch (DataIntegrityViolationException exception) {
            throw new ResourceAlreadyExistsException("Un scrape catalogue est deja en cours.");
        }

        worker.run(run.getId(), operation, scope);
        return messageService.buildResponse("catalog.sync.started", new CatalogSyncRunDTO(run));
    }
}
