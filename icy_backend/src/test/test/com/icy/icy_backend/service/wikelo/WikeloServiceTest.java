package com.icy.icy_backend.service.wikelo;

import com.icy.icy_backend.db.entity.utils.WikeloShip;
import com.icy.icy_backend.db.repository.utils.WikeloShipRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class WikeloServiceTest {
    private final WikeloShipRepository repository = mock(WikeloShipRepository.class);
    private final WikeloShipRecipeScraper scraper = mock(WikeloShipRecipeScraper.class);
    private final WikeloService service = new WikeloService(repository, scraper, mock(MessageService.class));

    private WikeloShip offer(String mission) {
        WikeloShip ship = new WikeloShip();
        ship.setShipName("Polaris Wikelo Special");
        ship.setMissionId(mission);
        ship.setRewardUuid("bc4aa5c5-2e9b-40d6-aa95-0757a763efff");
        ship.setCostText("50 × Wikelo Favor");
        ship.setSourceVersion("4.10.1-LIVE.12660092");
        ship.setSourceUrl("https://api.star-citizen.wiki/missions/polaris");
        ship.setScrapedAt(LocalDateTime.now());
        return ship;
    }

    @Test void emptyOrFailedImportNeverDeletesPublishedOffers() {
        when(scraper.scrape()).thenReturn(List.of());
        assertThatThrownBy(service::rescrapeShips).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(repository);
        when(scraper.scrape()).thenThrow(new IllegalStateException("API HTTP 503"));
        assertThatThrownBy(service::rescrapeShips).hasMessageContaining("503");
        verifyNoInteractions(repository);
    }

    @Test void rejectsLegacyOrDuplicateSnapshotBeforeDeletingPublishedOffers() {
        WikeloShip legacy = offer("contract"); legacy.setSourceVersion(null);
        assertThatThrownBy(() -> service.publishScrapedShips(List.of(legacy)))
                .isInstanceOf(IllegalStateException.class);
        WikeloShip ship = offer("contract");
        assertThatThrownBy(() -> service.publishScrapedShips(List.of(ship, ship)))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(repository);
    }

    @Test void preservesDifferentContractsForTheSameRewardShip() {
        var ships = List.of(offer("contract-a"), offer("contract-b"));
        when(repository.saveAll(ships)).thenReturn(new ArrayList<>(ships));
        assertThat(service.publishScrapedShips(ships)).hasSize(2);
        var order = inOrder(repository);
        order.verify(repository).deleteAllInBatch();
        order.verify(repository).saveAll(ships);
    }
}
