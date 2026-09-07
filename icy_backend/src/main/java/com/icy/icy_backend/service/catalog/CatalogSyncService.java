package com.icy.icy_backend.service.catalog;

import com.icy.icy_backend.controller.dto.response.admin.CatalogSyncRunDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.catalog.CatalogSyncRun;
import com.icy.icy_backend.db.repository.catalog.CatalogSyncRunRepository;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

@Service
public class CatalogSyncService {
    private static final List<String> INTERRUPTED_STATUSES = List.of("QUEUED", "RUNNING");
    private static final List<String> BLOCKING_STATUSES = List.of("QUEUED", "RUNNING", "WAITING_FOR_REVIEW");

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

    @EventListener(ApplicationReadyEvent.class)
    public void failInterruptedRuns() {
        List<CatalogSyncRun> interruptedRuns = runRepository.findByStatusIn(INTERRUPTED_STATUSES);
        for (CatalogSyncRun run : interruptedRuns) {
            run.setStatus("FAILED");
            run.setMessage("Traitement interrompu avant sa fin");
            run.setErrorMessage("Le processus de synchronisation a ete interrompu");
            run.setCompletedAt(OffsetDateTime.now(ZoneOffset.UTC));
        }
        if (!interruptedRuns.isEmpty()) {
            runRepository.saveAllAndFlush(interruptedRuns);
        }
    }

    public ResponseEntity<MessageResponse<CatalogSyncRunDTO>> startScrapeAndMap(String rawScope) {
        return start("SCRAPE_AND_MAP", CatalogSyncScope.parse(rawScope));
    }

    public ResponseEntity<MessageResponse<CatalogSyncRunDTO>> current() {
        CatalogSyncRun run = runRepository.findFirstByOrderByCreatedAtDesc().orElse(null);
        return messageService.buildResponse("catalog.sync.current", run == null ? null : new CatalogSyncRunDTO(run));
    }

    public void resumeAfterReview(long runId) {
        CatalogSyncRun run = runRepository.findById(runId)
                .orElseThrow(() -> new IllegalArgumentException("Traitement catalogue introuvable"));
        if (!"WAITING_FOR_REVIEW".equals(run.getStatus())) {
            throw new IllegalStateException("Ce traitement catalogue n'attend pas de validation");
        }
        run.setStatus("QUEUED");
        run.setMessage("Choix enregistres; reprise du traitement");
        runRepository.saveAndFlush(run);
        CatalogSyncScope scope = run.getScope() == null ? null : CatalogSyncScope.parse(run.getScope());
        worker.resumeAfterReview(run.getId(), run.getOperation(), scope);
    }

    private ResponseEntity<MessageResponse<CatalogSyncRunDTO>> start(String operation, CatalogSyncScope scope) {
        if (runRepository.existsByStatusIn(BLOCKING_STATUSES)) {
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
            if (runRepository.existsByStatusIn(BLOCKING_STATUSES)) {
                throw new ResourceAlreadyExistsException("Un scrape catalogue est deja en cours.");
            }
            throw exception;
        }

        worker.run(run.getId(), operation, scope);
        return messageService.buildResponse("catalog.sync.started", new CatalogSyncRunDTO(run));
    }
}
