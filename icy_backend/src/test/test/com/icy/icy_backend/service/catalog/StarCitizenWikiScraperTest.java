package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.config.CatalogSyncProperties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class StarCitizenWikiScraperTest {

    @Test
    void fetchesMineableDetailsAndPreservesUnknownVersion() {
        var properties = new CatalogSyncProperties();
        properties.setWikiBaseUrl("https://catalog.test/api");
        var store = mock(CatalogRawStore.class);
        when(store.upsert(org.mockito.ArgumentMatchers.eq(CatalogMapper.WIKI_SOURCE),
                org.mockito.ArgumentMatchers.eq("commodities"), anyList(), org.mockito.ArgumentMatchers.eq(8L)))
                .thenReturn(1);
        var rest = new RestTemplate();
        var server = MockRestServiceServer.bindTo(rest).build();
        String uuid = "fc1ec740-3047-48d8-81f0-396f4c9a90ef";
        server.expect(requestTo("https://catalog.test/api/commodities?page%5Bnumber%5D=1&page%5Bsize%5D=200"))
                .andRespond(withSuccess("{\"data\":[{\"uuid\":\"" + uuid + "\",\"is_mineable\":true}]}",
                        org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://catalog.test/api/commodities/" + uuid + "?page%5Bnumber%5D=1&page%5Bsize%5D=200"))
                .andRespond(withSuccess("{\"data\":{\"uuid\":\"" + uuid + "\",\"systems_grouped\":[]},\"meta\":{\"processed_at\":\"2026-09-19 05:00:10\"}}",
                        org.springframework.http.MediaType.APPLICATION_JSON));
        assertThat(new StarCitizenWikiScraper(properties, store, new ObjectMapper(), rest).scrape("commodities", 8L))
                .isEqualTo(1);
        verify(store).upsert(org.mockito.ArgumentMatchers.eq(CatalogMapper.WIKI_SOURCE),
                org.mockito.ArgumentMatchers.eq("commodities"), org.mockito.ArgumentMatchers.argThat(rows ->
                        rows.getFirst().has("systems_grouped") && !rows.getFirst().has("version")
                                && "2026-09-19T05:00:10Z".equals(rows.getFirst().path("updated_at").asText())),
                org.mockito.ArgumentMatchers.eq(8L));
        server.verify();
    }

    @Test
    void declaresTheProductionConstructorForSpringInjection() throws NoSuchMethodException {
        var constructor = StarCitizenWikiScraper.class.getConstructor(
                CatalogSyncProperties.class,
                CatalogRawStore.class,
                ObjectMapper.class
        );

        assertThat(constructor.isAnnotationPresent(Autowired.class)).isTrue();
    }

    @Test
    void readsWikiJsonAsTextBeforeParsingItWithTheApplicationObjectMapper() {
        CatalogSyncProperties properties = new CatalogSyncProperties();
        properties.setWikiBaseUrl("https://catalog.test/api");
        properties.setPageSize(200);
        properties.setUserAgent("IceForge-Test/1.0");

        CatalogRawStore rawStore = mock(CatalogRawStore.class);
        when(rawStore.upsert(
                org.mockito.ArgumentMatchers.eq(CatalogMapper.WIKI_SOURCE),
                org.mockito.ArgumentMatchers.eq("vehicles"),
                anyList(),
                org.mockito.ArgumentMatchers.eq(42L)
        )).thenReturn(1);

        RestTemplate restTemplate = new RestTemplate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(restTemplate).build();
        server.expect(once(), requestTo("https://catalog.test/api/vehicles?page%5Bnumber%5D=1&page%5Bsize%5D=200"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("User-Agent", "IceForge-Test/1.0"))
                .andRespond(withSuccess("""
                        {
                          "data": [{"uuid": "ship-1", "name": "Test Ship"}],
                          "meta": {"last_page": 1}
                        }
                        """, org.springframework.http.MediaType.APPLICATION_JSON));

        StarCitizenWikiScraper scraper = new StarCitizenWikiScraper(
                properties,
                rawStore,
                new ObjectMapper(),
                restTemplate
        );

        assertThat(scraper.scrape("vehicles", 42L)).isEqualTo(1);
        server.verify();
        verify(rawStore).deactivateMissing(CatalogMapper.WIKI_SOURCE, "vehicles", 42L);
    }
}
