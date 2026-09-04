package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.icy.icy_backend.config.CatalogSyncProperties;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;

@Service
public class StarCitizenWikiScraper {
    private static final List<String> DATASETS = List.of("vehicles", "items", "locations");

    private final CatalogSyncProperties properties;
    private final CatalogRawStore rawStore;
    private final RestTemplate restTemplate = new RestTemplate();

    public StarCitizenWikiScraper(CatalogSyncProperties properties, CatalogRawStore rawStore) {
        this.properties = properties;
        this.rawStore = rawStore;
    }

    public List<String> datasets() {
        return DATASETS;
    }

    public int scrape(String datasetKey, long runId) {
        if (!DATASETS.contains(datasetKey)) {
            throw new IllegalArgumentException("Dataset Star Citizen Wiki inconnu: " + datasetKey);
        }

        int page = 1;
        int lastPage = 1;
        int imported = 0;
        do {
            JsonNode root = fetchPage(datasetKey, page);
            JsonNode data = root.path("data");
            if (!data.isArray() || (page == 1 && data.isEmpty())) {
                throw new IllegalStateException("Reponse vide ou invalide pour " + datasetKey + " page " + page);
            }

            List<JsonNode> records = new ArrayList<>(data.size());
            data.forEach(records::add);
            imported += rawStore.upsert(CatalogMapper.WIKI_SOURCE, datasetKey, records, runId);
            lastPage = Math.max(1, root.path("meta").path("last_page").asInt(1));
            page++;
        } while (page <= lastPage);

        if (imported == 0) {
            throw new IllegalStateException("Le scan Wiki n'a importe aucun record pour " + datasetKey);
        }
        rawStore.deactivateMissing(CatalogMapper.WIKI_SOURCE, datasetKey, runId);
        return imported;
    }

    private JsonNode fetchPage(String datasetKey, int page) {
        String baseUrl = properties.getWikiBaseUrl().replaceAll("/+$", "");
        int pageSize = Math.max(1, Math.min(200, properties.getPageSize()));
        String url = baseUrl + "/" + datasetKey
                + "?page%5Bnumber%5D=" + page
                + "&page%5Bsize%5D=" + pageSize;

        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.set(HttpHeaders.USER_AGENT, properties.getUserAgent());
        ResponseEntity<JsonNode> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(headers),
                JsonNode.class
        );
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new IllegalStateException("Star Citizen Wiki indisponible pour " + datasetKey + " page " + page);
        }
        return response.getBody();
    }
}
