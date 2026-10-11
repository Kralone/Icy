package com.icy.icy_backend.service.wikelo;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

/** Imports released, deterministic contracts from the versioned Wiki game-data API. */
@Service
public class WikeloEquipmentRecipeScraper {
    private final WikeloMissionScraper missions;

    public WikeloEquipmentRecipeScraper(WikeloMissionScraper missions) { this.missions = missions; }

    public List<WikeloEquipmentRecipe> scrape() {
        List<WikeloEquipmentRecipe> result = new ArrayList<>();
        for (JsonNode mission : missions.scrape()) {
            WikeloEquipmentRecipe recipe = parseMission(mission);
            if (recipe != null) result.add(recipe);
        }
        if (result.isEmpty()) throw new IllegalStateException("Aucune recette Wikelo complète; données publiées conservées");
        return List.copyOf(result);
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
                required(mission, "web_url"), WikeloMissionScraper.version(mission), ingredients, items);
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
