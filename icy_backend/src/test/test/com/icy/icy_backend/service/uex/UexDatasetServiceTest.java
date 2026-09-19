package com.icy.icy_backend.service.uex;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.config.UexProperties;
import com.icy.icy_backend.db.entity.utils.UexDatasetCache;
import com.icy.icy_backend.db.repository.utils.UexDatasetCacheRepository;
import com.icy.icy_backend.service.common.MessageService;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.ResourceBundleMessageSource;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UexDatasetServiceTest {
    final ObjectMapper mapper = new ObjectMapper();
    final UexDatasetCacheRepository repository = mock(UexDatasetCacheRepository.class);
    UexDatasetService service() {
        ResourceBundleMessageSource messages = new ResourceBundleMessageSource();
        messages.setBasename("messages");
        return new UexDatasetService(repository, new MessageService(messages), new UexProperties(), mapper);
    }
    void cache(String key, String json) throws Exception {
        when(repository.findById(key)).thenReturn(Optional.of(new UexDatasetCache(key, "https://example.test", mapper.readTree(json), 1, OffsetDateTime.now(), null, null)));
    }
    @Test void refineryAndAdminPayloadsSerializeAsActualArraysWithJackson3() throws Exception {
        cache("refineries_yields", "[{\"value\":-5},{\"value\":0}]");
        var jsonMapper = tools.jackson.databind.json.JsonMapper.builder().build();
        var data = service().getRefineryDatasets().getBody().getData();
        var json = jsonMapper.readTree(jsonMapper.writeValueAsString(data));
        assertTrue(json.get("yields").isArray());
        assertEquals(-5, json.get("yields").get(0).get("value").asInt());
        assertEquals(0, json.get("yields").get(1).get("value").asInt());
        var preview = service().getDataset("refineries_yields").getBody().getData().getPreviewPayload();
        assertTrue(jsonMapper.readTree(jsonMapper.writeValueAsString(preview)).isArray());
    }
    @Test void staleOrUndatedHigherPricesCannotDriveEstimates() throws Exception {
        cache("commodities", "[{\"name\":\"Gold\"}]");
        long now = java.time.Instant.now().getEpochSecond();
        cache("commodities_prices", "[{\"commodity_name\":\"Gold\",\"terminal_name\":\"Recent\",\"price_sell\":100,\"date_modified\":" + now + "},{\"commodity_name\":\"Gold\",\"terminal_name\":\"Old\",\"price_sell\":900,\"date_modified\":1},{\"commodity_name\":\"Gold\",\"terminal_name\":\"Undated\",\"price_sell\":800}]");
        var row = service().listResourceSales(List.of("Gold")).getBody().getData().getFirst();
        assertEquals(100, row.getBestSell());
        assertEquals("Recent", row.getBestSellTerminal());
        assertNull(row.getBaseSell());
        assertEquals(1, row.getSalePoints().size());
        assertNotNull(row.getSalePoints().getFirst().getObservedAt());
    }
    @Test void malformedRefreshDoesNotOverwriteLastGoodCache() throws Exception {
        var transport = new org.springframework.web.client.RestTemplate();
        var server = org.springframework.test.web.client.MockRestServiceServer.createServer(transport);
        var config = new UexProperties();
        config.setBaseUrl("https://example.test");
        config.setRefreshAttempts(1);
        var messages = new ResourceBundleMessageSource();
        messages.setBasename("messages");
        var subject = new UexDatasetService(repository, new MessageService(messages), config, mapper, transport);
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo("https://example.test/refineries_yields"))
                .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess(
                        "{\"status\":\"ok\",\"data\":{\"error\":\"bad payload\"}}", org.springframework.http.MediaType.APPLICATION_JSON));
        subject.refreshDataset("refineries_yields");
        verify(repository, never()).save(any());
        server.verify();
    }
}
