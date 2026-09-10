package com.icy.icy_backend.service.wikelo;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Locale;

/** Published equipment explicitly attributed to Wikelo; this is not an exchange recipe source. */
@Service
public class WikeloEquipmentCatalog {
    // Reviewed 2026-09-10. Exact affiliations and exclusions: docs/wikelo-equipment-catalog.md.
    // Do not infer a Wikelo reward from generic descriptions, manufacturer or variant suffixes.
    static final List<String> VERIFIED_NAMES = List.of(
            "Testudo Helmet Clanguard",
            "Testudo Arms Clanguard",
            "Testudo Core Clanguard",
            "Testudo Legs Clanguard",
            "Testudo Backpack Clanguard",
            "Strata Helmet Heatwave",
            "Strata Arms Heatwave",
            "Strata Core Heatwave",
            "Strata Legs Heatwave",
            "Strata Backpack Heatwave",
            "Palatino Helmet Mark I",
            "Palatino Arms Mark I",
            "Palatino Core Mark I",
            "Palatino Legs Mark I",
            "Palatino Backpack Mark I",
            "Corbel Helmet Crush",
            "Corbel Arms Crush",
            "Corbel Core Crush",
            "Corbel Legs Crush",
            "Ana Helmet Endro",
            "Ana Arms Endro",
            "Ana Core Endro",
            "Ana Legs Endro",
            "Geist Armor Helmet Snow Camo",
            "Geist Armor Arms Snow Camo",
            "Geist Armor Core Snow Camo",
            "Geist Armor Legs Snow Camo",
            "Bokto Helmet",
            "Bokto Arms",
            "Bokto Core",
            "Bokto Legs",
            "DCP Armor Helmet Jungle Camo",
            "DCP Armor Arms Jungle Camo",
            "DCP Armor Core Jungle Camo",
            "DCP Armor Legs Jungle Camo",
            "DCP Armor Helmet Cobalt Camo",
            "DCP Armor Arms Cobalt Camo",
            "DCP Armor Core Cobalt Camo",
            "DCP Armor Legs Cobalt Camo",
            "DCP Armor Helmet Hunter Camo",
            "DCP Armor Arms Hunter Camo",
            "DCP Armor Core Hunter Camo",
            "DCP Armor Legs Hunter Camo",
            "Venture Helmet Ascension",
            "Venture Arms Ascension",
            "Venture Core Ascension",
            "Venture Legs Ascension",
            "BUL-H4 Helmet Snow Camo",
            "BUL-H4 Armor Snow Camo",
            "H4-PBF Ammo Carrier Snow Camo",
            "Geist Backpack Snow Camo",
            "Novikov Backpack Crush",
            "Boomtube \"Clanguard\" Rocket Launcher",
            "Tripledown \"Heatwave\" Pistol",
            "Vendetta \"Snow Camo\" HMG",
            "Zenith \"Snow Camo\" Laser Sniper Rifle",
            "Prism \"Irradiated\" Laser Shotgun",
            "Fresnel \"Yormandi\" Energy LMG",
            "Fresnel \"Deepwater\" Energy LMG",
            "F55 \"Mark I\" LMG",
            "Coda \"Ascension\" Pistol",
            "Karna \"Ascension\" Rifle",
            "S71 \"Ascension\" Rifle",
            "Quartz \"Jungle Camo\" Energy SMG",
            "Quartz \"Cobalt Camo\" Energy SMG",
            "Quartz \"Hunter Camo\" Energy SMG",
            "Parallax \"Fun Kopion Skull\" Energy Assault Rifle",
            "Parallax \"Fun Kopion Tooth\" Energy Assault Rifle",
            "Parallax \"Fun Military Skull\" Energy Assault Rifle",
            "Parallax \"Fun Military Tooth\" Energy Assault Rifle",
            "GP-33 MOD \"Quite Useful\" Grenade Launcher",
            "Scourge \"Quite Useful\" Railgun",
            "Animus \"Quite Useful\" Missile Launcher"
    );
    private final JdbcTemplate jdbcTemplate;
    private final WikeloEquipmentRecipeStore recipeStore;

    public WikeloEquipmentCatalog(JdbcTemplate jdbcTemplate, WikeloEquipmentRecipeStore recipeStore) {
        this.recipeStore = recipeStore;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public List<Equipment> getEquipment() {
        List<WikeloEquipmentRecipe> recipes = recipeStore.published();
        var names = new LinkedHashSet<>(VERIFIED_NAMES);
        recipes.forEach(recipe -> recipe.rewards().stream().map(WikeloEquipmentRecipe.Reward::name)
                .filter(WikeloEquipmentCatalog::isEquipmentReward).map(WikeloEquipmentCatalog::catalogName).forEach(names::add));
        return jdbcTemplate.query("""
                SELECT id, name, family, manufacturer, description,
                       CASE WHEN image_is_fallback THEN NULL ELSE image_url END AS image_url,
                       source_url
                FROM catalog.entries
                WHERE active = TRUE
                  AND source = 'STAR_CITIZEN_WIKI'
                  AND dataset_key = 'items'
                  AND family IN ('FPS_WEAPON', 'ARMOR')
                  AND (family <> 'FPS_WEAPON' OR source_payload->>'type' = 'WeaponPersonal')
                  AND name IN (%s)
                ORDER BY family, name, id
                """.formatted(String.join(",", Collections.nCopies(names.size(), "?"))),
                (row, index) -> new Equipment(
                row.getLong("id"), row.getString("name"), row.getString("family"),
                row.getString("manufacturer"), row.getString("description"),
                row.getString("image_url"), row.getString("source_url"), recipesFor(row.getString("name"), recipes)
        ), names.toArray());
    }

    static List<WikeloEquipmentRecipe> recipesFor(String name, List<WikeloEquipmentRecipe> recipes) {
        return recipes.stream().filter(recipe -> recipe.rewards().stream()
                .anyMatch(reward -> isEquipmentReward(reward.name()) && catalogName(reward.name()).equals(name))).toList();
    }
    static boolean isEquipmentReward(String name) {
        return name != null && !name.toLowerCase(Locale.ROOT).contains("blueprint");
    }
    static String catalogName(String name) {
        // Explicit source alias only; never collapse variant suffixes or infer a base model.
        return name.startsWith("Ana Armor ") ? "Ana " + name.substring("Ana Armor ".length()) : name;
    }

    public record Equipment(long id, String name, String family, String manufacturer,
                            String description, String imageUrl, String sourceUrl, List<WikeloEquipmentRecipe> recipes) {}
}
