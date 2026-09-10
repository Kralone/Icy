package com.icy.icy_backend.service.wikelo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/** Imports released, deterministic contracts from the versioned Wiki game-data API. */
@Service
public class WikeloEquipmentRecipeScraper {
    private static final String API = "https://api.star-citizen.wiki/api/missions";
    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    public WikeloEquipmentRecipeScraper(ObjectMapper mapper) { this.mapper = mapper; }

    public List<WikeloEquipmentRecipe> scrape() {
        List<WikeloEquipmentRecipe> result = new ArrayList<>();
        String version = null;
        int lastPage = 1;
        for (int page = 1; page <= lastPage; page++) {
            JsonNode response = fetch(API + "?filter%5Bfaction%5D=Wikelo%20Emporium&page%5Bnumber%5D=" + page
                    + (version == null ? "" : "&version=" + version));
            lastPage = response.path("meta").path("last_page").asInt(0);
            if (lastPage < page || lastPage > 20 || !response.path("data").isArray())
                throw new IllegalStateException("Pagination des contrats Wikelo invalide");
            for (JsonNode summary : response.path("data")) {
                if (version == null) version = required(summary, "game_version");
                if (!released(summary) || !summary.path("has_hauling").asBoolean()
                        || !"Other".equals(summary.path("reward_scope").asText())) continue;
                String uuid = required(summary, "uuid");
                if (!uuid.matches("[a-f0-9-]{36}")) throw new IllegalStateException("Identifiant de mission invalide");
                WikeloEquipmentRecipe recipe = parseMission(fetch(API + "/" + uuid + "?version=" + version).path("data"));
                if (recipe != null) result.add(recipe);
            }
        }
        if (result.isEmpty()) throw new IllegalStateException("Aucune recette Wikelo complète; données publiées conservées");
        return List.copyOf(result);
    }

    JsonNode fetch(String url) {
        try {
            var response = client.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30))
                    .header("Accept", "application/json").header("User-Agent", "IceForge-Catalog/1.0").GET().build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw new IllegalStateException("API Wikelo HTTP " + response.statusCode());
            return mapper.readTree(response.body());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Import Wikelo interrompu", exception);
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("Lecture des recettes Wikelo impossible", exception);
        }
    }

    WikeloEquipmentRecipe parseMission(JsonNode mission) {
        if (!released(mission) || !"Wikelo Emporium".equals(mission.path("faction").path("name").asText())) return null;
        // Multiple reward groups represent alternatives; never present their union as a guaranteed set.
        JsonNode groups = mission.path("reward_groups");
        if (!groups.isArray() || groups.size() != 1) return null;
        // The API leaves weight null for unweighted groups. Only an explicit
        // nonpositive weight disables this single group; no alternative is merged.
        JsonNode weight = groups.get(0).path("weight");
        if (!weight.isMissingNode() && !weight.isNull()) {
            if (!weight.isNumber()) throw new IllegalStateException("Pondération de récompense invalide");
            if (weight.asDouble() <= 0) return null;
        }
        JsonNode orders = mission.path("hauling_orders"), rewards = groups.get(0).path("items");
        if (!orders.isArray() || orders.isEmpty() || !rewards.isArray() || rewards.isEmpty()) return null;
        var ingredients = new ArrayList<WikeloEquipmentRecipe.Ingredient>();
        for (JsonNode order : orders) {
            if (order.path("items").size() > 0 || order.path("or_options").size() > 0) return null; // Alternative item pools require a richer contract.
            boolean scu = !order.path("max_scu").isNull() && order.has("max_scu");
            ingredients.add(new WikeloEquipmentRecipe.Ingredient(required(order, "name"),
                    amount(order, scu ? "min_scu" : "min_amount", scu ? "max_scu" : "max_amount") + (scu ? " SCU" : "")));
        }
        var items = new ArrayList<WikeloEquipmentRecipe.Reward>();
        for (JsonNode reward : rewards) {
            String amount = required(reward, "amount");
            if (!reward.path("amount").isNumber() || reward.path("amount").asDouble() <= 0)
                throw new IllegalStateException("Quantité de récompense absente");
            items.add(new WikeloEquipmentRecipe.Reward(required(reward, "name"), amount));
        }
        String reputation = mission.path("min_standing").isNull() ? null : mission.path("min_standing").asText(null);
        return new WikeloEquipmentRecipe(required(mission, "uuid"), required(mission, "title"), reputation,
                required(mission, "web_url"), required(mission, "game_version"), ingredients, items);
    }

    private boolean released(JsonNode node) {
        return node.path("released").asBoolean(false) && !node.path("not_for_release").asBoolean()
                && !node.path("work_in_progress").asBoolean();
    }
    private String amount(JsonNode node, String minKey, String maxKey) {
        JsonNode max = node.path(maxKey), min = node.path(minKey);
        if (!max.isNumber() || max.asDouble() <= 0) throw new IllegalStateException("Quantité d’ingrédient absente");
        if (min.isNumber() && min.asDouble() != max.asDouble()) return min.asText() + "–" + max.asText();
        return max.asText();
    }
    private String required(JsonNode node, String field) {
        String value = node.path(field).asText("").strip();
        if (value.isBlank()) throw new IllegalStateException("Champ de contrat Wikelo absent : " + field);
        return value;
    }
}
