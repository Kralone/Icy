package com.icy.icy_backend.service.wikelo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.service.catalog.CatalogRawStore;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.HashSet;
import java.util.List;

@Service
public class WikeloEquipmentRecipeStore {
    private final WikeloEquipmentRecipeScraper scraper;
    private final CatalogRawStore rawStore;
    private final ObjectMapper mapper;
    private final JdbcTemplate jdbc;

    public WikeloEquipmentRecipeStore(WikeloEquipmentRecipeScraper scraper, CatalogRawStore rawStore,
                                     ObjectMapper mapper, JdbcTemplate jdbc) {
        this.scraper = scraper; this.rawStore = rawStore; this.mapper = mapper; this.jdbc = jdbc;
    }

    @Transactional
    public int scrapeAndStore(long runId) {
        List<WikeloEquipmentRecipe> recipes = scraper.scrape();
        validate(recipes);
        List<JsonNode> nodes = recipes.stream().map(recipe -> {
            var node = mapper.<com.fasterxml.jackson.databind.node.ObjectNode>valueToTree(recipe);
            if (recipe.sourceVersion() != null) node.put("version", recipe.sourceVersion());
            return (JsonNode) node;
        }).toList();
        int count = rawStore.upsert("WIKELO", "equipment_recipes", nodes, runId);
        if (count != recipes.size()) throw new IllegalStateException("Import incomplet des recettes Wikelo");
        rawStore.deactivateMissing("WIKELO", "equipment_recipes", runId);
        return count;
    }

    @Transactional
    public int publish(long runId) {
        List<WikeloEquipmentRecipe> recipes = rawStore.loadActive("WIKELO", "equipment_recipes").stream()
                .map(this::decode).toList();
        validate(recipes);
        for (WikeloEquipmentRecipe recipe : recipes) {
            jdbc.update("""
                    INSERT INTO catalog.wikelo_equipment_recipes(id,payload,active,published_at,last_seen_run_id)
                    VALUES (?,CAST(? AS jsonb),TRUE,NOW(),?)
                    ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,active=TRUE,
                        published_at=NOW(),last_seen_run_id=EXCLUDED.last_seen_run_id
                    """, recipe.id(), encode(recipe), runId);
        }
        jdbc.update("UPDATE catalog.wikelo_equipment_recipes SET active=FALSE WHERE last_seen_run_id<>? AND active=TRUE", runId);
        return recipes.size();
    }

    @Transactional(readOnly = true)
    public List<WikeloEquipmentRecipe> published() {
        return jdbc.query("SELECT payload::text FROM catalog.wikelo_equipment_recipes WHERE active=TRUE ORDER BY id",
                (row, index) -> {
                    try { return mapper.readValue(row.getString(1), WikeloEquipmentRecipe.class); }
                    catch (Exception error) { throw new IllegalStateException("Recette Wikelo publiée illisible", error); }
                });
    }

    private WikeloEquipmentRecipe decode(JsonNode node) {
        try {
            JsonNode payload = node.deepCopy();
            if (payload.isObject()) ((com.fasterxml.jackson.databind.node.ObjectNode) payload).remove("version");
            return mapper.treeToValue(payload, WikeloEquipmentRecipe.class);
        }
        catch (Exception error) { throw new IllegalStateException("Recette Wikelo brute invalide", error); }
    }
    private String encode(WikeloEquipmentRecipe recipe) {
        try { return mapper.writeValueAsString(recipe); }
        catch (Exception error) { throw new IllegalStateException("Recette Wikelo non sérialisable", error); }
    }
    static void validate(List<WikeloEquipmentRecipe> recipes) {
        if (recipes == null || recipes.isEmpty()) throw new IllegalStateException("Aucune recette Wikelo valide ; publication précédente conservée");
        var ids = new HashSet<String>();
        for (var recipe : recipes) {
            if (recipe == null || blank(recipe.id()) || blank(recipe.name()) || blank(recipe.sourceUrl())
                    || !ids.add(recipe.id()) || recipe.ingredients() == null || recipe.rewards() == null || recipe.rewards().isEmpty())
                throw new IllegalStateException("Recettes Wikelo incomplètes ou dupliquées ; publication précédente conservée");
            for (var ingredient : recipe.ingredients())
                if (ingredient == null || blank(ingredient.name()) || blank(ingredient.quantity()))
                    throw new IllegalStateException("Ingrédient Wikelo incomplet");
            for (var reward : recipe.rewards())
                if (reward == null || blank(reward.name()) || blank(reward.quantity()))
                    throw new IllegalStateException("Récompense Wikelo incomplète");
        }
    }
    private static boolean blank(String text) { return text == null || text.isBlank(); }
}
