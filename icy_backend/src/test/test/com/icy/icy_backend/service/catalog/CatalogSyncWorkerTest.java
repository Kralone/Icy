package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.config.CatalogSyncProperties;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.utils.UexDatasetDetailDTO;
import com.icy.icy_backend.db.entity.catalog.CatalogSyncRun;
import com.icy.icy_backend.db.entity.utils.WikeloShip;
import com.icy.icy_backend.db.repository.catalog.CatalogSyncRunRepository;
import com.icy.icy_backend.service.uex.UexDatasetService;
import com.icy.icy_backend.service.wikelo.WikeloService;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CatalogSyncWorkerTest {

    @Test
    void scrapesEverySourceBeforeMappingEveryCatalogFamily() {
        CatalogSyncRunRepository runRepository = mock(CatalogSyncRunRepository.class);
        StarCitizenWikiScraper wikiScraper = mock(StarCitizenWikiScraper.class);
        CatalogMapper catalogMapper = mock(CatalogMapper.class);
        CatalogEconomyMapper economyMapper = mock(CatalogEconomyMapper.class);
        CatalogRawStore rawStore = mock(CatalogRawStore.class);
        UexDatasetService uexDatasetService = mock(UexDatasetService.class);
        WikeloService wikeloService = mock(WikeloService.class);
        CatalogSyncProperties properties = new CatalogSyncProperties();

        CatalogSyncRun run = new CatalogSyncRun();
        run.setId(42L);
        when(runRepository.findById(42L)).thenReturn(Optional.of(run));
        when(wikiScraper.datasets()).thenReturn(List.of("vehicles", "items", "locations"));
        when(wikiScraper.scrape("vehicles", 42L)).thenReturn(10);
        when(wikiScraper.scrape("items", 42L)).thenReturn(20);
        when(wikiScraper.scrape("locations", 42L)).thenReturn(30);

        when(uexDatasetService.supportedDatasetKeys()).thenReturn(List.of("vehicles_prices"));
        UexDatasetDetailDTO uexDetail = new UexDatasetDetailDTO();
        uexDetail.setItemCount(4);
        MessageResponse<UexDatasetDetailDTO> uexBody = new MessageResponse<>(
                HttpStatus.OK, "OK", "OK", 2000, uexDetail
        );
        when(uexDatasetService.refreshDataset("vehicles_prices"))
                .thenReturn(ResponseEntity.ok(uexBody));

        WikeloShip wikeloShip = new WikeloShip(
                null, "Test Ship", "Mission", "Cost", "Reputation", "Components",
                "Test sheet", "https://example.test/wikelo", LocalDateTime.now(), null
        );
        when(wikeloService.scrapeShips()).thenReturn(List.of(wikeloShip));

        CatalogSyncWorker worker = new CatalogSyncWorker(
                runRepository,
                wikiScraper,
                catalogMapper,
                economyMapper,
                rawStore,
                uexDatasetService,
                wikeloService,
                properties,
                new ObjectMapper().findAndRegisterModules()
        );

        worker.run(42L, "SCRAPE_AND_MAP_ALL", null);

        InOrder order = inOrder(wikiScraper, uexDatasetService, wikeloService, catalogMapper, economyMapper);
        order.verify(wikiScraper).scrape("vehicles", 42L);
        order.verify(wikiScraper).scrape("items", 42L);
        order.verify(wikiScraper).scrape("locations", 42L);
        order.verify(uexDatasetService).refreshDataset("vehicles_prices");
        order.verify(wikeloService).scrapeShips();
        order.verify(catalogMapper).mapWikiDataset("vehicles", 42L);
        order.verify(catalogMapper).mapWikiDataset("items", 42L);
        order.verify(catalogMapper).mapWikiDataset("locations", 42L);
        order.verify(economyMapper).map(42L);
        order.verify(wikeloService).publishScrapedShips(List.of(wikeloShip));

        assertThat(run.getStatus()).isEqualTo("SUCCEEDED");
        assertThat(run.getCurrentStep()).isEqualTo(10);
        assertThat(run.getTotalSteps()).isEqualTo(10);
        assertThat(run.getMessage()).contains("tout le catalogue");
    }
}
