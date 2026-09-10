package com.icy.icy_backend.service.wikelo;

import java.util.List;

/** Source quantities remain textual so units and non-numeric conditions are not lost. */
public record WikeloEquipmentRecipe(String id, String name, String reputation, String sourceUrl,
                                   String sourceVersion, List<Ingredient> ingredients, List<Reward> rewards) {
    public record Ingredient(String name, String quantity) {}
    public record Reward(String name, String quantity) {}
}
