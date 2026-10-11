package com.icy.icy_backend.service.wikelo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.icy.icy_backend.config.CatalogSyncProperties;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import static org.assertj.core.api.Assertions.*;

class WikeloMissionScraperTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final List<String> urls = new ArrayList<>();

    private ObjectNode mission(String title) throws Exception {
        try (var input = getClass().getResourceAsStream("/wikelo/missions-api-4.10.1.json")) {
            for (JsonNode node : mapper.readTree(input))
                if (title.equals(node.path("title").asText())) return (ObjectNode) node.deepCopy();
        }
        throw new AssertionError(title);
    }
    private JsonNode page(JsonNode mission, int total, int pages) {
        var root = mapper.createObjectNode();
        root.putObject("meta").put("last_page", pages).put("total", total);
        var summary = mission.<ObjectNode>deepCopy();
        summary.put("has_hauling", true).put("reward_scope", "Other");
        root.putArray("data").add(summary);
        return root;
    }
    private JsonNode detail(JsonNode mission) {
        var root = mapper.createObjectNode(); root.set("data", mission); return root;
    }
    private WikeloMissionScraper source(Function<String, JsonNode> response) {
        return new WikeloMissionScraper(mapper, new CatalogSyncProperties()) {
            @Override JsonNode fetch(String url) { urls.add(url); return response.apply(url); }
        };
    }

    @Test void pinsAllPagesAndDetailsToTheSameVersion() throws Exception {
        var f8 = mission("F8 War Mod"); var polaris = mission("Now make Polaris. Short Time Deal.");
        var client = source(url -> url.contains("page%5Bnumber%5D=1") ? page(f8, 2, 2)
                : url.contains("page%5Bnumber%5D=2") ? page(polaris, 2, 2)
                : detail(url.contains(f8.path("uuid").asText()) ? f8 : polaris));
        assertThat(client.scrape()).hasSize(2);
        assertThat(urls).hasSize(4);
        assertThat(urls.subList(1, urls.size())).allSatisfy(url -> assertThat(url).contains("version=4.10.1-LIVE.12660092"));
    }

    @Test void acceptsTheCurrentVersionFieldWithoutDeprecatedGameVersion() throws Exception {
        var f8 = mission("F8 War Mod"); f8.remove("game_version");
        assertThat(source(url -> url.contains("page%5B") ? page(f8, 1, 1) : detail(f8)).scrape()).hasSize(1);
    }

    @Test void refusesChangedVersionOrWrongDetailIdentifier() throws Exception {
        var f8 = mission("F8 War Mod"); var wrong = f8.deepCopy(); wrong.put("version", "different-version");
        assertThatThrownBy(() -> source(url -> url.contains("page%5B") ? page(f8, 1, 1) : detail(wrong)).scrape())
                .hasMessageContaining("incohérent");
        wrong.put("version", f8.path("version").asText()).put("uuid", "wrong-id");
        assertThatThrownBy(() -> source(url -> url.contains("page%5B") ? page(f8, 1, 1) : detail(wrong)).scrape())
                .hasMessageContaining("incohérent");
    }

    @Test void rejectsTruncatedDuplicateOrEmptyPagination() throws Exception {
        var f8 = mission("F8 War Mod");
        assertThatThrownBy(() -> source(url -> url.contains("page%5B") ? page(f8, 2, 1) : detail(f8)).scrape())
                .hasMessageContaining("incomplet");
        assertThatThrownBy(() -> source(url -> url.contains("page%5B") ? page(f8, 2, 2) : detail(f8)).scrape())
                .hasMessageContaining("dupliqué");
        var empty = mapper.createObjectNode(); empty.putArray("data");
        assertThatThrownBy(() -> source(url -> empty).scrape()).hasMessageContaining("Pagination");
    }

    @Test void excludesUnreleasedContractsWithoutFetchingTheirDetails() throws Exception {
        var f8 = mission("F8 War Mod"); f8.put("released", false);
        assertThatThrownBy(() -> source(url -> page(f8, 1, 1)).scrape()).hasMessageContaining("vide");
        assertThat(urls).hasSize(1);
    }
}
