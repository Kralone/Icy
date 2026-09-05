package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.config.CatalogSyncProperties;
import org.junit.jupiter.api.Test;
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
