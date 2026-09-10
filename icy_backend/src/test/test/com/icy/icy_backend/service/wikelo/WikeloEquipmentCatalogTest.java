package com.icy.icy_backend.service.wikelo;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class WikeloEquipmentCatalogTest {
    @Test void verifiedRewardVariantsDoNotNeedWikeloInTheirDescription() {
        assertThat(WikeloEquipmentCatalog.VERIFIED_NAMES).contains(
                "Testudo Helmet Clanguard", "Strata Core Heatwave", "Ana Arms Endro",
                "Palatino Arms Mark I", "BUL-H4 Armor Snow Camo",
                "Boomtube \"Clanguard\" Rocket Launcher", "Vendetta \"Snow Camo\" HMG");
    }

    @Test void standardVariantsAndThemedSubscriberItemsAreNotRewards() {
        assertThat(WikeloEquipmentCatalog.VERIFIED_NAMES).doesNotContain(
                "Testudo Helmet Turfwar", "Strata Core", "Corbel Core Mire",
                "Palatino Arms", "Palatino Arms Daystar", "BUL-H4 Armor",
                "Wikelo Emporium Jacket", "Wikelo Emporium Bust", "Wikelo Favor");
        assertThat(WikeloEquipmentCatalog.VERIFIED_NAMES).doesNotHaveDuplicates();
    }

    @Test void sourceRecipeMatchesExactRewardVariantAndKnownAliasOnly() {
        var recipe = new WikeloEquipmentRecipe("trade", "Trade", "None", "https://starcitizen.tools/Wikelo", "v1",
                java.util.List.of(new WikeloEquipmentRecipe.Ingredient("Carinite", "24 SCU")),
                java.util.List.of(new WikeloEquipmentRecipe.Reward("Ana Armor Arms Endro", "1"),
                        new WikeloEquipmentRecipe.Reward("Testudo Helmet Clanguard blueprint", "1")));
        var recipes = java.util.List.of(recipe);
        assertThat(WikeloEquipmentCatalog.recipesFor("Ana Arms Endro", recipes)).containsExactly(recipe);
        assertThat(WikeloEquipmentCatalog.recipesFor("Ana Arms", recipes)).isEmpty();
        assertThat(WikeloEquipmentCatalog.recipesFor("Testudo Helmet Clanguard", recipes)).isEmpty();
        assertThat(recipe.ingredients().getFirst().quantity()).isEqualTo("24 SCU");
    }
}
