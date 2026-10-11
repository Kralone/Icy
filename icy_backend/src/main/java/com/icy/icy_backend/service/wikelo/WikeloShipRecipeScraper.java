package com.icy.icy_backend.service.wikelo;

import com.fasterxml.jackson.databind.JsonNode;
import com.icy.icy_backend.db.entity.ship.Ship;
import com.icy.icy_backend.db.entity.utils.WikeloShip;
import com.icy.icy_backend.service.catalog.CatalogMapper;
import com.icy.icy_backend.service.catalog.CatalogRawStore;
import com.icy.icy_backend.service.ship.ShipCatalogEnrichment;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Rewards are joined by UUID, never inferred from a mission title or a base-model name. */
@Service
public class WikeloShipRecipeScraper {
    private final WikeloMissionScraper missions;
    private final WikeloEquipmentRecipeScraper contracts;
    private final CatalogRawStore rawStore;

    public WikeloShipRecipeScraper(WikeloMissionScraper missions, WikeloEquipmentRecipeScraper contracts,
                                  CatalogRawStore rawStore) {
        this.missions = missions;
        this.contracts = contracts;
        this.rawStore = rawStore;
    }

    public List<WikeloShip> scrape() {
        Map<String, JsonNode> vehicles = new LinkedHashMap<>();
        for (JsonNode vehicle : rawStore.loadActive(CatalogMapper.WIKI_SOURCE, "vehicles")) {
            String uuid = WikeloMissionScraper.required(vehicle, "uuid");
            if (vehicles.putIfAbsent(uuid, vehicle) != null)
                throw new IllegalStateException("UUID véhicule dupliqué dans le catalogue Wikelo");
        }
        if (vehicles.isEmpty()) throw new IllegalStateException("Catalogue vaisseaux absent ; import Wikelo annulé");
        var ships = new ArrayList<WikeloShip>();
        for (JsonNode mission : missions.scrape()) ships.addAll(parseMission(mission, vehicles));
        WikeloService.validate(ships);
        return List.copyOf(ships);
    }

    List<WikeloShip> parseMission(JsonNode mission, Map<String, JsonNode> vehicles) {
        if (!"Wikelo - Vehicles".equals(mission.path("mission_type").asText())) return List.of();
        WikeloEquipmentRecipe recipe = contracts.parseMission(mission);
        if (recipe == null) return List.of();
        var result = new ArrayList<WikeloShip>();
        JsonNode rewards = mission.path("reward_groups").get(0).path("items");
        for (JsonNode reward : rewards) {
            JsonNode vehicle = vehicles.get(reward.path("uuid").asText());
            // Mixed bundles also contain armor and weapons; they remain additional rewards.
            if (vehicle == null) {
                String uuid = WikeloMissionScraper.required(reward, "uuid");
                if (!uuid.matches("[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}"))
                    throw new IllegalStateException("Identifiant de récompense Wikelo invalide");
                JsonNode item = missions.fetchItem(uuid, recipe.sourceVersion());
                // The item endpoint identifies some vehicles absent from the vehicle dataset (Pulse).
                if ("Vehicle".equals(item.path("type").asText())
                        || (item.has("is_spaceship") && item.has("cargo_capacity"))) vehicle = item;
            }
            if (vehicle == null) continue;
            if (reward.path("amount").asDouble() != 1)
                throw new IllegalStateException("Quantité de vaisseaux Wikelo non prise en charge");
            String vehicleVersion = WikeloMissionScraper.version(vehicle);
            if (!recipe.sourceVersion().equals(vehicleVersion))
                throw new IllegalStateException("Version du vaisseau différente du contrat Wikelo ; actualiser le catalogue");
            WikeloShip ship = new WikeloShip();
            ship.setShipName(WikeloMissionScraper.required(vehicle, "name"));
            String manufacturer = vehicle.path("manufacturer").path("name").asText("");
            ship.setRewardManufacturer(manufacturer.isBlank() ? null : manufacturer);
            for (JsonNode image : vehicle.path("images")) {
                String url = image.path("original_url").asText("");
                if (url.isBlank()) url = image.path("thumbnail_url").asText("");
                if (url.startsWith("https://")) { ship.setRewardImageUrl(url); break; }
            }
            ship.setMissionId(recipe.id());
            ship.setRewardUuid(WikeloMissionScraper.required(reward, "uuid"));
            ship.setMissionText(recipe.name());
            ship.setCostText(recipe.ingredients().stream().map(ingredient -> ingredient.quantity().endsWith(" SCU")
                    ? ingredient.quantity() + " " + ingredient.name()
                    : ingredient.quantity() + " × " + ingredient.name()).collect(Collectors.joining(" | ")));
            ship.setReputationText(recipe.reputation());
            ship.setSourceUrl(recipe.sourceUrl());
            ship.setSourceVersion(recipe.sourceVersion());
            ship.setScrapedAt(LocalDateTime.now());
            Ship loadout = new Ship();
            ShipCatalogEnrichment.applyPayload(loadout, vehicle);
            var components = new ArrayList<String>();
            for (Ship.LoadoutItem item : loadout.getComponents())
                components.add("Component: " + item.quantity() + " × " + item.name());
            for (Ship.LoadoutItem item : loadout.getWeapons())
                components.add("Weapon: " + item.quantity() + " × " + item.name());
            ship.setComponentsText(components.isEmpty() ? null : String.join(" | ", components));
            var extras = new ArrayList<String>();
            for (JsonNode other : rewards) if (!other.path("uuid").asText().equals(ship.getRewardUuid()))
                extras.add(WikeloMissionScraper.required(other, "amount") + " × "
                        + WikeloMissionScraper.required(other, "name"));
            ship.setRewardsText(extras.isEmpty() ? null : String.join(" | ", extras));
            result.add(ship);
        }
        if (result.isEmpty()) throw new IllegalStateException("Aucun véhicule identifié pour le contrat Wikelo : " + recipe.id());
        return result;
    }
}
