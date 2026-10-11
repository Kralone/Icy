package com.icy.icy_backend.service.wikelo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.config.CatalogSyncProperties;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

/** Pins pagination and mission details to a single game-data version. */
@Service
public class WikeloMissionScraper {
    private final ObjectMapper mapper;
    private final CatalogSyncProperties properties;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    public WikeloMissionScraper(ObjectMapper mapper, CatalogSyncProperties properties) {
        this.mapper = mapper;
        this.properties = properties;
    }

    public List<JsonNode> scrape() {
        String api = properties.getWikiBaseUrl().replaceAll("/+$", "") + "/missions";
        String version = properties.getWikiVersion();
        if (version != null && version.isBlank()) version = null;
        var result = new ArrayList<JsonNode>();
        var ids = new HashSet<String>();
        int lastPage = 1;
        int total = -1;
        for (int page = 1; page <= lastPage; page++) {
            JsonNode response = fetch(api + "?filter%5Bfaction%5D=Wikelo%20Emporium&page%5Bnumber%5D=" + page
                    + (version == null ? "" : "&version=" + encode(version)));
            int pages = response.path("meta").path("last_page").asInt(0);
            int count = response.path("meta").path("total").asInt(-1);
            JsonNode data = response.path("data");
            if (pages < page || pages > 20 || !data.isArray() || data.isEmpty() || count < 1
                    || (page > 1 && (pages != lastPage || count != total)))
                throw new IllegalStateException("Pagination des contrats Wikelo invalide");
            lastPage = pages;
            total = count;
            for (JsonNode summary : data) {
                String currentVersion = version(summary);
                if (version == null) version = currentVersion;
                if (!version.equals(currentVersion)) throw new IllegalStateException("Versions Wikelo incohérentes");
                String uuid = required(summary, "uuid");
                if (!uuid.matches("[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}") || !ids.add(uuid))
                    throw new IllegalStateException("Identifiant de mission Wikelo invalide ou dupliqué");
                if (!released(summary) || !summary.path("has_hauling").asBoolean()
                        || !"Other".equals(summary.path("reward_scope").asText())) continue;
                JsonNode mission = fetch(api + "/" + uuid + "?version=" + encode(version)).path("data");
                if (!uuid.equals(mission.path("uuid").asText()) || !version.equals(version(mission)))
                    throw new IllegalStateException("Détail de mission Wikelo incohérent");
                if (released(mission) && "Wikelo Emporium".equals(mission.path("faction").path("name").asText()))
                    result.add(mission);
            }
        }
        if (ids.size() != total || result.isEmpty())
            throw new IllegalStateException("Import Wikelo vide ou incomplet ; publication conservée");
        return List.copyOf(result);
    }

    JsonNode fetch(String url) {
        try {
            var response = client.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30))
                    .header("Accept", "application/json").header("User-Agent", properties.getUserAgent())
                    .GET().build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw new IllegalStateException("API Wikelo HTTP " + response.statusCode());
            return mapper.readTree(response.body());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Import Wikelo interrompu", exception);
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("Lecture des recettes Wikelo impossible", exception);
        }
    }

    JsonNode fetchItem(String uuid, String version) {
        JsonNode item = fetch(properties.getWikiBaseUrl().replaceAll("/+$", "")
                + "/items/" + uuid + "?version=" + encode(version)).path("data");
        if (!uuid.equals(item.path("uuid").asText()) || !version.equals(version(item)))
            throw new IllegalStateException("Détail de récompense Wikelo incohérent");
        return item;
    }

    static boolean released(JsonNode node) {
        return node.path("released").asBoolean(false) && !node.path("not_for_release").asBoolean()
                && !node.path("work_in_progress").asBoolean();
    }

    static String version(JsonNode node) {
        return node.path("version").asText("").isBlank() ? required(node, "game_version") : required(node, "version");
    }

    static String required(JsonNode node, String field) {
        String value = node.path(field).asText("").strip();
        if (value.isBlank()) throw new IllegalStateException("Champ de contrat Wikelo absent : " + field);
        return value;
    }

    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
}
