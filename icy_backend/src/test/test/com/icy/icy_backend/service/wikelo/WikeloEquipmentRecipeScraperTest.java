package com.icy.icy_backend.service.wikelo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class WikeloEquipmentRecipeScraperTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final WikeloEquipmentRecipeScraper scraper = new WikeloEquipmentRecipeScraper(mapper);
    private ObjectNode ana() throws Exception {
        try (var input = getClass().getResourceAsStream("/wikelo/ana-mission.json")) {
            return (ObjectNode) mapper.readTree(input).path("data");
        }
    }
    @Test void importsCompleteVersionedAnaSet() throws Exception {
        var recipe = scraper.parseMission(ana());
        assertEquals(5, recipe.ingredients().size());
        assertEquals("Carinite (Pure)", recipe.ingredients().get(0).name());
        assertEquals("1", recipe.ingredients().get(0).quantity());
        assertEquals(4, recipe.rewards().size());
        assertEquals("Ana Arms Endro", recipe.rewards().get(0).name());
        assertEquals("4.10.0-LIVE.12519617", recipe.sourceVersion());
    }
    @Test void doesNotPublishUnreleasedOrRandomRewards() throws Exception {
        var mission = ana(); mission.put("released", false);
        assertNull(scraper.parseMission(mission));
        mission = ana(); mission.withArray("reward_groups").add(mission.path("reward_groups").get(0).deepCopy());
        assertNull(scraper.parseMission(mission));
    }
    @Test void rejectsMissingQuantityAndAlternativeIngredientPools() throws Exception {
        var mission = ana(); ((ObjectNode)mission.path("hauling_orders").get(0)).putNull("max_amount");
        assertThrows(IllegalStateException.class, () -> scraper.parseMission(mission));
        var alternative = ana(); ((ObjectNode)alternative.path("hauling_orders").get(0)).putArray("or_options").addArray().add("choice");
        assertNull(scraper.parseMission(alternative));
    }
}
