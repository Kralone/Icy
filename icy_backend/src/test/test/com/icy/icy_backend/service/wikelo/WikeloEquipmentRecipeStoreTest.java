package com.icy.icy_backend.service.wikelo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.service.catalog.CatalogRawStore;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class WikeloEquipmentRecipeStoreTest {
    final WikeloEquipmentRecipeScraper scraper = mock(WikeloEquipmentRecipeScraper.class);
    final CatalogRawStore raw = mock(CatalogRawStore.class);
    final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    final ObjectMapper mapper = new ObjectMapper();
    final WikeloEquipmentRecipeStore store = new WikeloEquipmentRecipeStore(scraper, raw, mapper, jdbc);
    final WikeloEquipmentRecipe recipe = new WikeloEquipmentRecipe("Armor_with_Vanduul", "Armor with Vanduul", "None",
            "https://starcitizen.tools/Armor_with_Vanduul", "oldid=123", List.of(new WikeloEquipmentRecipe.Ingredient("Vanduul Metal", "15")),
            List.of(new WikeloEquipmentRecipe.Reward("Testudo Helmet Clanguard", "1")));

    @Test void emptyScrapeDoesNotReplaceRawOrPublishedRecipes() {
        when(scraper.scrape()).thenReturn(List.of());
        assertThatThrownBy(() -> store.scrapeAndStore(4L)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(raw, jdbc);
    }
    @Test void malformedStoredSnapshotDoesNotErasePublishedRecipes() {
        when(raw.loadActive("WIKELO", "equipment_recipes")).thenReturn(List.of(mapper.valueToTree(
                new WikeloEquipmentRecipe("broken", "Broken", null, "https://starcitizen.tools/Wikelo", null, List.of(), List.of()))));
        assertThatThrownBy(() -> store.publish(4L)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(jdbc);
    }
    @Test void duplicateContractIdentifiersRejectTheSnapshotBeforeWrites() {
        when(scraper.scrape()).thenReturn(List.of(recipe, recipe));
        assertThatThrownBy(() -> store.scrapeAndStore(4L)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(raw, jdbc);
    }
    @Test void collectionPersistsRawBeforeDeactivatingOldRowsAndDoesNotPublish() {
        when(scraper.scrape()).thenReturn(List.of(recipe));
        when(raw.upsert(eq("WIKELO"), eq("equipment_recipes"), anyList(), eq(4L))).thenReturn(1);
        assertThat(store.scrapeAndStore(4L)).isEqualTo(1);
        var order = inOrder(raw);
        order.verify(raw).upsert(eq("WIKELO"), eq("equipment_recipes"), anyList(), eq(4L));
        order.verify(raw).deactivateMissing("WIKELO", "equipment_recipes", 4L);
        verifyNoInteractions(jdbc);
    }
    @Test void publicationUsesStoredSnapshotAndPreservesSourceQuantities() {
        when(raw.loadActive("WIKELO", "equipment_recipes")).thenReturn(List.of(mapper.valueToTree(recipe)));
        assertThat(store.publish(4L)).isEqualTo(1);
        verifyNoInteractions(scraper);
        verify(jdbc).update(contains("INSERT INTO catalog.wikelo_equipment_recipes"), eq(recipe.id()),
                argThat((String json) -> json.contains("Vanduul Metal") && json.contains("oldid=123")), eq(4L));
        verify(jdbc).update(contains("SET active=FALSE"), eq(4L));
    }
}
