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
import com.icy.icy_backend.service.wikelo.WikeloEquipmentRecipeStore;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;

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
        WikeloEquipmentRecipeStore recipes = mock(WikeloEquipmentRecipeStore.class);
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
                recipes,
                properties,
                new ObjectMapper().findAndRegisterModules()
        );

        worker.run(42L, "SCRAPE_ALL", null);

        InOrder order = inOrder(wikiScraper, uexDatasetService, wikeloService, recipes, catalogMapper, economyMapper);
        order.verify(wikiScraper).scrape("vehicles", 42L);
        order.verify(wikiScraper).scrape("items", 42L);
        order.verify(wikiScraper).scrape("locations", 42L);
        order.verify(uexDatasetService).refreshDataset("vehicles_prices");
        order.verify(wikeloService).scrapeShips();
        order.verify(recipes).scrapeAndStore(42L);
        order.verify(catalogMapper).mapWikiDataset("vehicles", 42L);
        order.verify(catalogMapper).mapWikiDataset("items", 42L);
        order.verify(catalogMapper).mapWikiDataset("locations", 42L);
        order.verify(economyMapper).map(42L);
        order.verify(wikeloService).publishScrapedShips(List.of(wikeloShip));

        order.verify(recipes).publish(42L);

        assertThat(run.getStatus()).isEqualTo("SUCCEEDED");
        assertThat(run.getCurrentStep()).isEqualTo(12);
        assertThat(run.getTotalSteps()).isEqualTo(12);
        assertThat(run.getMessage()).contains("tout le catalogue");
    }

    @Test
    void wikeloScopeRefreshesVehiclesBeforePublishingOffers() {
        CatalogSyncRunRepository runs = mock(CatalogSyncRunRepository.class);
        StarCitizenWikiScraper wiki = mock(StarCitizenWikiScraper.class);
        CatalogMapper mapper = mock(CatalogMapper.class);
        CatalogEconomyMapper economy = mock(CatalogEconomyMapper.class);
        CatalogRawStore raw = mock(CatalogRawStore.class);
        UexDatasetService uex = mock(UexDatasetService.class);
        WikeloService wikelo = mock(WikeloService.class);
        WikeloEquipmentRecipeStore recipes = mock(WikeloEquipmentRecipeStore.class);
        CatalogSyncRun run = new CatalogSyncRun(); run.setId(7L);
        when(runs.findById(7L)).thenReturn(Optional.of(run));
        when(wiki.scrape("vehicles", 7L)).thenReturn(11);
        WikeloShip ship = new WikeloShip(null, "Polaris", "Mission", "Cost", null, null,
                "Ships", "https://example.test", LocalDateTime.now(), null);
        when(wikelo.scrapeShips()).thenReturn(List.of(ship));
        when(recipes.scrapeAndStore(7L)).thenReturn(2);
        when(mapper.mapWikiDataset("vehicles", 7L)).thenReturn(11);
        when(recipes.publish(7L)).thenReturn(2);
        CatalogSyncWorker worker = new CatalogSyncWorker(runs, wiki, mapper, economy, raw, uex,
                wikelo, recipes, new CatalogSyncProperties(), new ObjectMapper().findAndRegisterModules());

        worker.run(7L, "SCRAPE", CatalogSyncScope.WIKELO);

        InOrder order = inOrder(wiki, wikelo, recipes, mapper);
        order.verify(wiki).scrape("vehicles", 7L);
        order.verify(wikelo).scrapeShips();
        order.verify(recipes).scrapeAndStore(7L);
        order.verify(mapper).mapWikiDataset("vehicles", 7L);
        order.verify(wikelo).publishScrapedShips(List.of(ship));
        order.verify(recipes).publish(7L);
        assertThat(run.getStatus()).isEqualTo("SUCCEEDED");
        assertThat(run.getCurrentStep()).isEqualTo(6);
        assertThat(run.getTotalSteps()).isEqualTo(6);
    }

    @Test
    void wikeloReviewResumeUsesStoredSourcesWithoutRescraping() {
        CatalogSyncRunRepository runs = mock(CatalogSyncRunRepository.class);
        StarCitizenWikiScraper wiki = mock(StarCitizenWikiScraper.class);
        CatalogMapper mapper = mock(CatalogMapper.class);
        CatalogRawStore raw = mock(CatalogRawStore.class);
        WikeloService wikelo = mock(WikeloService.class);
        WikeloEquipmentRecipeStore recipes = mock(WikeloEquipmentRecipeStore.class);
        CatalogSyncRun run = new CatalogSyncRun(); run.setId(8L);
        when(runs.findById(8L)).thenReturn(Optional.of(run));
        when(wiki.scrape("vehicles", 8L)).thenReturn(1);
        WikeloShip ship = new WikeloShip(null, "Polaris", "Mission", "Cost", null, null,
                "Ships", "https://example.test", LocalDateTime.now(), null);
        when(wikelo.scrapeShips()).thenReturn(List.of(ship));
        when(recipes.scrapeAndStore(8L)).thenReturn(1);
        when(mapper.mapWikiDataset("vehicles", 8L)).thenThrow(new CatalogReviewRequiredException(1)).thenReturn(1);
        ObjectMapper testMapper = new ObjectMapper().findAndRegisterModules();
        when(raw.loadActive("WIKELO", "offers")).thenReturn(List.of(testMapper.valueToTree(ship)));
        when(recipes.publish(8L)).thenReturn(1);
        CatalogSyncWorker worker = new CatalogSyncWorker(runs, wiki, mapper, mock(CatalogEconomyMapper.class), raw,
                mock(UexDatasetService.class), wikelo, recipes, new CatalogSyncProperties(), new ObjectMapper().findAndRegisterModules());

        worker.run(8L, "SCRAPE", CatalogSyncScope.WIKELO);
        assertThat(run.getStatus()).isEqualTo("WAITING_FOR_REVIEW");
        worker.resumeAfterReview(8L, "SCRAPE", CatalogSyncScope.WIKELO);

        verify(wiki).scrape("vehicles", 8L);
        verify(wikelo).scrapeShips();
        verify(wikelo).publishScrapedShips(org.mockito.ArgumentMatchers.anyList());
        assertThat(run.getStatus()).isEqualTo("SUCCEEDED");
    }
}
