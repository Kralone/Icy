package com.icy.icy_backend.service.wikelo;

import com.icy.icy_backend.config.WikeloProperties;
import com.icy.icy_backend.db.repository.utils.WikeloShipRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class WikeloServiceTest {

    @Test
    void exportsRawRowsWithoutMergingCreditsIntoShipNames() {
        WikeloProperties properties = new WikeloProperties();
        properties.setSpreadsheetId("sheet-id");
        properties.setShipsGid(1L);
        WikeloService service = new WikeloService(Mockito.mock(WikeloShipRepository.class), properties,
                Mockito.mock(MessageService.class)) {
            @Override
            String fetchCsv(String csvUrl) {
                assertThat(csvUrl).contains("headers=0");
                return "\"Components based on Datamining by Contributor\",\"\",\"\"\n"
                        + "\"Golem\",\"#\",\"Component\"\n"
                        + "\"Mission: Golem Rocks - Cost: 2x Wikelo Favor\",\"\",\"\"\n";
            }
        };
        assertThat(service.scrapeShips()).singleElement().satisfies(ship -> {
            assertThat(ship.getShipName()).isEqualTo("Golem");
            assertThat(ship.getCostText()).isEqualTo("2x Wikelo Favor");
        });
        properties.setShipsGid(null);
        properties.setShipsSheetName("Ships");
        assertThat(service.scrapeShips()).singleElement().satisfies(ship ->
                assertThat(ship.getShipName()).isEqualTo("Golem"));
    }

    @Test
    void rescrapeKeepsPublishedRowsWhenSourceIsEmpty() {
        WikeloShipRepository repository = Mockito.mock(WikeloShipRepository.class);
        WikeloProperties properties = new WikeloProperties();
        properties.setSpreadsheetId("sheet-id");
        properties.setShipsGid(1L);
        MessageService messageService = Mockito.mock(MessageService.class);

        WikeloService service = new WikeloService(repository, properties, messageService) {
            @Override
            String fetchCsv(String csvUrl) {
                return "";
            }
        };

        assertThatThrownBy(service::rescrapeShips)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("donnees publiees sont conservees");

        verify(repository, never()).deleteAllInBatch();
    }
}
