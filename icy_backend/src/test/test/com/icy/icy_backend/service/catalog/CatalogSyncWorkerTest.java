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

        WikeloShip wikeloShip = offer("Test Ship");
        when(wikeloService.scrapeShips()).thenReturn(List.of(wikeloShip));
        when(rawStore.upsert(org.mockito.ArgumentMatchers.eq("WIKELO"), org.mockito.ArgumentMatchers.eq("offers"),
                org.mockito.ArgumentMatchers.anyList(), org.mockito.ArgumentMatchers.eq(42L))).thenReturn(1);

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
    void locationsScopeRefreshesUexPlaceListsBeforeMapping() {
        CatalogSyncRunRepository runs = mock(CatalogSyncRunRepository.class);
        StarCitizenWikiScraper wiki = mock(StarCitizenWikiScraper.class);
        CatalogMapper mapper = mock(CatalogMapper.class);
        UexDatasetService uex = mock(UexDatasetService.class);
        CatalogSyncProperties properties = new CatalogSyncProperties();
        properties.setUexDelayMillis(0);
        CatalogSyncRun run = new CatalogSyncRun(); run.setId(9L);
        when(runs.findById(9L)).thenReturn(Optional.of(run));
        when(wiki.scrape("locations", 9L)).thenReturn(30);
        UexDatasetDetailDTO detail = new UexDatasetDetailDTO();
        detail.setItemCount(3);
        MessageResponse<UexDatasetDetailDTO> body = new MessageResponse<>(HttpStatus.OK, "OK", "OK", 2000, detail);
        for (String dataset : CatalogMapper.UEX_PLACE_DATASETS) {
            when(uex.refreshDataset(dataset)).thenReturn(ResponseEntity.ok(body));
        }
        when(mapper.mapWikiDataset("locations", 9L)).thenReturn(30);
        CatalogSyncWorker worker = new CatalogSyncWorker(runs, wiki, mapper, mock(CatalogEconomyMapper.class),
                mock(CatalogRawStore.class), uex, mock(WikeloService.class), mock(WikeloEquipmentRecipeStore.class),
                properties, new ObjectMapper().findAndRegisterModules());

        worker.run(9L, "SCRAPE", CatalogSyncScope.LOCATIONS);

        InOrder order = inOrder(wiki, uex, mapper);
        order.verify(wiki).scrape("locations", 9L);
        order.verify(uex).refreshDataset("space_stations");
        order.verify(uex).refreshDataset("cities");
        order.verify(uex).refreshDataset("outposts");
        order.verify(mapper).mapWikiDataset("locations", 9L);
        assertThat(run.getStatus()).isEqualTo("SUCCEEDED");
        assertThat(run.getCurrentStep()).isEqualTo(run.getTotalSteps());
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
        WikeloShip ship = offer("Polaris");
        when(wikelo.scrapeShips()).thenReturn(List.of(ship));
        when(raw.upsert(org.mockito.ArgumentMatchers.eq("WIKELO"), org.mockito.ArgumentMatchers.eq("offers"),
                org.mockito.ArgumentMatchers.anyList(), org.mockito.ArgumentMatchers.eq(7L))).thenReturn(1);
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
        WikeloShip ship = offer("Polaris");
        when(wikelo.scrapeShips()).thenReturn(List.of(ship));
        when(raw.upsert(org.mockito.ArgumentMatchers.eq("WIKELO"), org.mockito.ArgumentMatchers.eq("offers"),
                org.mockito.ArgumentMatchers.anyList(), org.mockito.ArgumentMatchers.eq(8L))).thenReturn(1);
        when(recipes.scrapeAndStore(8L)).thenReturn(1);
        when(mapper.mapWikiDataset("vehicles", 8L)).thenThrow(new CatalogReviewRequiredException(1)).thenReturn(1);
        ObjectMapper testMapper = new ObjectMapper().findAndRegisterModules();
        var stored = testMapper.<com.fasterxml.jackson.databind.node.ObjectNode>valueToTree(ship);
        stored.put("uuid", ship.getMissionId() + ":" + ship.getRewardUuid());
        stored.put("version", ship.getSourceVersion());
        when(raw.loadActive("WIKELO", "offers")).thenReturn(List.of(stored));
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
    private static WikeloShip offer(String name) {
        var ship = new WikeloShip();
        ship.setShipName(name);
        ship.setMissionId("e05b8ffb-7455-4f24-bbcf-43e9dffc0cca");
        ship.setRewardUuid("bc4aa5c5-2e9b-40d6-aa95-0757a763efff");
        ship.setSourceVersion("4.10.1-LIVE.12660092");
        ship.setMissionText("Mission");
        ship.setCostText("50 × Wikelo Favor");
        ship.setSourceUrl("https://api.star-citizen.wiki/missions/polaris");
        ship.setScrapedAt(LocalDateTime.now());
        return ship;
    }
}
