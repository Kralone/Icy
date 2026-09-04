package com.icy.icy_backend.service.wikelo;

import com.icy.icy_backend.config.WikeloProperties;
import com.icy.icy_backend.db.repository.utils.WikeloShipRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class WikeloServiceTest {

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
