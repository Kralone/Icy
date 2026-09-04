package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.config.CatalogSyncProperties;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.utils.UexDatasetDetailDTO;
import com.icy.icy_backend.db.entity.catalog.CatalogSyncRun;
import com.icy.icy_backend.db.entity.utils.WikeloShip;
import com.icy.icy_backend.db.repository.catalog.CatalogSyncRunRepository;
import com.icy.icy_backend.service.uex.UexDatasetService;
import com.icy.icy_backend.service.wikelo.WikeloService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

@Service
public class CatalogSyncWorker {
    private static final Logger logger = LoggerFactory.getLogger(CatalogSyncWorker.class);

    private final CatalogSyncRunRepository runRepository;
    private final StarCitizenWikiScraper wikiScraper;
    private final CatalogMapper catalogMapper;
    private final CatalogEconomyMapper economyMapper;
    private final CatalogRawStore rawStore;
    private final UexDatasetService uexDatasetService;
    private final WikeloService wikeloService;
    private final CatalogSyncProperties properties;
    private final ObjectMapper objectMapper;

    public CatalogSyncWorker(
            CatalogSyncRunRepository runRepository,
            StarCitizenWikiScraper wikiScraper,
            CatalogMapper catalogMapper,
            CatalogEconomyMapper economyMapper,
            CatalogRawStore rawStore,
            UexDatasetService uexDatasetService,
            WikeloService wikeloService,
            CatalogSyncProperties properties,
            ObjectMapper objectMapper
    ) {
        this.runRepository = runRepository;
        this.wikiScraper = wikiScraper;
        this.catalogMapper = catalogMapper;
        this.economyMapper = economyMapper;
        this.rawStore = rawStore;
        this.uexDatasetService = uexDatasetService;
        this.wikeloService = wikeloService;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Async("catalogSyncExecutor")
    public void run(long runId, String operation, CatalogSyncScope scope) {
        CatalogSyncRun run = requiredRun(runId);
        try {
            run.setStatus("RUNNING");
            run.setStartedAt(OffsetDateTime.now(ZoneOffset.UTC));
            run.setTotalSteps(totalSteps(operation, scope));
            run.setMessage("Demarrage du traitement");
            save(run);

            if ("SCRAPE_ALL".equals(operation)) {
                scrapeAll(run);
            } else {
                scrapeAndMap(run, scope);
            }

            run.setStatus("SUCCEEDED");
            run.setMessage("Traitement termine");
            run.setCompletedAt(OffsetDateTime.now(ZoneOffset.UTC));
            save(run);
        } catch (Exception exception) {
            logger.error("Echec du run catalogue {}", runId, exception);
            run.setStatus("FAILED");
            run.setMessage("Le traitement a echoue; les donnees mappees precedentes sont conservees");
            run.setErrorMessage(exception.getMessage());
            run.setCompletedAt(OffsetDateTime.now(ZoneOffset.UTC));
            save(run);
        }
    }

    private void scrapeAll(CatalogSyncRun run) {
        for (String dataset : wikiScraper.datasets()) {
            int count = wikiScraper.scrape(dataset, run.getId());
            advance(run, "Wiki " + dataset + " : " + count + " lignes brutes");
        }

        List<String> uexDatasets = uexDatasetService.supportedDatasetKeys();
        for (int index = 0; index < uexDatasets.size(); index++) {
            String dataset = uexDatasets.get(index);
            int count = refreshUex(dataset);
            advance(run, "UEX " + dataset + " : " + count + " lignes brutes");
            if (index + 1 < uexDatasets.size()) {
                waitForUexQuota();
            }
        }

        List<WikeloShip> wikeloRows = scrapeWikeloRaw(run.getId());
        advance(run, "Wikelo : " + wikeloRows.size() + " offres brutes");
    }

    private void scrapeAndMap(CatalogSyncRun run, CatalogSyncScope scope) {
        if (scope == null) {
            throw new IllegalArgumentException("Le scope a mapper est requis");
        }
        if (scope.wikiDataset() != null) {
            int rawCount = wikiScraper.scrape(scope.wikiDataset(), run.getId());
            advance(run, "Scrape " + scope.wikiDataset() + " : " + rawCount + " lignes");
            int mappedCount = catalogMapper.mapWikiDataset(scope.wikiDataset(), run.getId());
            advance(run, "Mapping " + scope.wikiDataset() + " : " + mappedCount + " fiches");
            return;
        }
        if (scope == CatalogSyncScope.ECONOMY) {
            List<String> datasets = economyMapper.requiredDatasets();
            for (int index = 0; index < datasets.size(); index++) {
                String dataset = datasets.get(index);
                int count = refreshUex(dataset);
                advance(run, "UEX " + dataset + " : " + count + " lignes");
                if (index + 1 < datasets.size()) {
                    waitForUexQuota();
                }
            }
            int mappedCount = economyMapper.map(run.getId());
            advance(run, "Mapping economie : " + mappedCount + " offres");
            return;
        }

        List<WikeloShip> rows = scrapeWikeloRaw(run.getId());
        advance(run, "Scrape Wikelo : " + rows.size() + " offres");
        wikeloService.publishScrapedShips(rows);
        advance(run, "Mapping Wikelo : " + rows.size() + " offres publiees");
    }

    private List<WikeloShip> scrapeWikeloRaw(long runId) {
        List<WikeloShip> rows = wikeloService.scrapeShips();
        if (rows.isEmpty()) {
            throw new IllegalStateException("Le scrape Wikelo est vide");
        }
        List<JsonNode> nodes = new ArrayList<>(rows.size());
        rows.forEach(row -> nodes.add(objectMapper.valueToTree(row)));
        rawStore.upsert("WIKELO", "offers", nodes, runId);
        rawStore.deactivateMissing("WIKELO", "offers", runId);
        return rows;
    }

    private int refreshUex(String dataset) {
        ResponseEntity<MessageResponse<UexDatasetDetailDTO>> response = uexDatasetService.refreshDataset(dataset);
        UexDatasetDetailDTO detail = response.getBody() == null ? null : response.getBody().getData();
        if (!response.getStatusCode().is2xxSuccessful() || detail == null) {
            throw new IllegalStateException("Echec du scrape UEX " + dataset);
        }
        return detail.getItemCount();
    }

    private void waitForUexQuota() {
        try {
            Thread.sleep(Math.max(0, properties.getUexDelayMillis()));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Le scrape UEX a ete interrompu", exception);
        }
    }

    private int totalSteps(String operation, CatalogSyncScope scope) {
        if ("SCRAPE_ALL".equals(operation)) {
            return wikiScraper.datasets().size() + uexDatasetService.supportedDatasetKeys().size() + 1;
        }
        if (scope == CatalogSyncScope.ECONOMY) {
            return economyMapper.requiredDatasets().size() + 1;
        }
        return 2;
    }

    private void advance(CatalogSyncRun run, String message) {
        run.setCurrentStep(run.getCurrentStep() + 1);
        run.setMessage(message);
        save(run);
    }

    private CatalogSyncRun requiredRun(long runId) {
        return runRepository.findById(runId)
                .orElseThrow(() -> new IllegalStateException("Run catalogue introuvable: " + runId));
    }

    private void save(CatalogSyncRun run) {
        runRepository.saveAndFlush(run);
    }
}
