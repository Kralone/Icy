package com.icy.icy_backend.service.wikelo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.icy.icy_backend.service.catalog.CatalogRawStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class WikeloShipRecipeScraperTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final WikeloMissionScraper missions = mock(WikeloMissionScraper.class);
    private final WikeloEquipmentRecipeScraper contracts = new WikeloEquipmentRecipeScraper(missions);
    private final CatalogRawStore raw = mock(CatalogRawStore.class);
    private final WikeloShipRecipeScraper scraper = new WikeloShipRecipeScraper(missions, contracts, raw);

    @BeforeEach void nonVehicleRewards() {
        when(missions.fetchItem(anyString(), anyString())).thenReturn(mapper.createObjectNode().put("type", "Armor"));
    }

    private List<JsonNode> fixture(String name) throws Exception {
        try (var input = getClass().getResourceAsStream("/wikelo/" + name)) {
            var result = new ArrayList<JsonNode>();
            mapper.readTree(input).forEach(result::add);
            return result;
        }
    }
    private JsonNode mission(String title) throws Exception {
        return fixture("missions-api-4.10.1.json").stream()
                .filter(m -> title.equals(m.path("title").asText())).findFirst().orElseThrow().deepCopy();
    }
    private Map<String, JsonNode> vehicles() throws Exception {
        var result = new LinkedHashMap<String, JsonNode>();
        fixture("vehicles-api-4.10.1.json").forEach(v -> result.put(v.path("uuid").asText(), v));
        return result;
    }

    @Test void validatesAllCurrentPublicContractsAgainstExactVehicleRewards() throws Exception {
        when(missions.scrape()).thenReturn(fixture("missions-api-4.10.1.json"));
        when(raw.loadActive("STAR_CITIZEN_WIKI", "vehicles")).thenReturn(fixture("vehicles-api-4.10.1.json"));
        try (var input = getClass().getResourceAsStream("/wikelo/pulse-item-api-4.10.1.json")) {
            when(missions.fetchItem("881acfdf-9376-4ad0-a78f-bca6b4ff3c9d", "4.10.1-LIVE.12660092"))
                    .thenReturn(mapper.readTree(input));
        }
        var ships = scraper.scrape();
        assertThat(ships).hasSize(42).allSatisfy(ship -> {
            assertThat(ship.getSourceVersion()).isEqualTo("4.10.1-LIVE.12660092");
            assertThat(ship.getMissionId()).isNotBlank();
            assertThat(ship.getRewardUuid()).isNotBlank();
            assertThat(ship.getCostText()).isNotBlank();
            assertThat(ship.getSourceUrl()).startsWith("https://api.star-citizen.wiki/missions/");
        });
        assertThat(ships).anySatisfy(ship -> assertThat(ship.getShipName()).isEqualTo("Mirai Pulse Wikelo Special"));
    }

    @Test void importsAllPolarisAndIdrisIngredientsWithoutInventingReputation() throws Exception {
        var polaris = scraper.parseMission(mission("Now make Polaris. Short Time Deal."), vehicles()).getFirst();
        assertThat(polaris.getCostText().split(" \\| ")).hasSize(20);
        assertThat(polaris.getCostText()).contains("50 × Wikelo Favor", "15 × Polaris Bit", "1 × RCMBNT-XTL-3");
        assertThat(polaris.getReputationText()).isNull();
        var idris = scraper.parseMission(mission("Special Idris For Killing"), vehicles()).getFirst();
        assertThat(idris.getCostText().split(" \\| ")).hasSize(20);
        assertThat(idris.getCostText()).contains("50 × Wikelo Favor", "5 × RCMBNT-XTL-3");
    }

    @Test void keepsWolfArmorAndWeaponBundleSeparateFromItsShipLoadout() throws Exception {
        var wolf = scraper.parseMission(mission("Most Special Wolf"), vehicles()).getFirst();
        assertThat(wolf.getShipName()).isEqualTo("L-21 Wolf Wikelo War Special");
        assertThat(wolf.getRewardsText()).contains("Antium Helmet Midnight Sun", "Fresnel \"Deepwater\" Energy LMG");
        assertThat(wolf.getRewardsText()).doesNotContain("Kruger L-21 Wolf");
    }

    @Test void readsTheActualF8VariantFitAndNeverSubstitutesItsBaseShip() throws Exception {
        var f8 = scraper.parseMission(mission("F8 War Mod"), vehicles()).getFirst();
        assertThat(f8.getShipName()).isEqualTo("F8C Lightning Wikelo War Special");
        assertThat(f8.getComponentsText()).contains("Component:", "Weapon:", "FR-76");
        var different = vehicles();
        ((ObjectNode) different.get(f8.getRewardUuid())).put("version", "older-version");
        assertThatThrownBy(() -> scraper.parseMission(mission("F8 War Mod"), different))
                .hasMessageContaining("Version du vaisseau différente");
    }

    @Test void rejectsMissingQuantitiesAndExcludesUnreleasedAndAlternativeContracts() throws Exception {
        var invalid = mission("F8 War Mod");
        ((ObjectNode) invalid.path("hauling_orders").get(0)).putNull("max_amount");
        assertThatThrownBy(() -> scraper.parseMission(invalid, vehicles())).isInstanceOf(IllegalStateException.class);
        var unreleased = (ObjectNode) mission("F8 War Mod"); unreleased.put("released", false);
        assertThat(scraper.parseMission(unreleased, vehicles())).isEmpty();
        var random = mission("F8 War Mod");
        ((ObjectNode) random).withArray("reward_groups").add(random.path("reward_groups").get(0).deepCopy());
        assertThat(scraper.parseMission(random, vehicles())).isEmpty();
    }

    @Test void refusesImportWhenVehicleCatalogIsMissing() {
        assertThatThrownBy(scraper::scrape).hasMessageContaining("Catalogue vaisseaux absent");
        verifyNoInteractions(missions);
    }

    @Test void missingVehicleInMixedBundleCannotSilentlyRemoveItsRecipe() throws Exception {
        var wolf = mission("Most Special Wolf");
        var catalog = vehicles();
        catalog.values().removeIf(vehicle -> "L-21 Wolf Wikelo War Special".equals(vehicle.path("name").asText()));
        assertThatThrownBy(() -> scraper.parseMission(wolf, catalog)).hasMessageContaining("Aucun véhicule identifié");
        JsonNode sourceWolf = vehicles().values().stream()
                .filter(vehicle -> "L-21 Wolf Wikelo War Special".equals(vehicle.path("name").asText()))
                .findFirst().orElseThrow();
        var item = sourceWolf.<ObjectNode>deepCopy(); item.put("type", "Vehicle");
        when(missions.fetchItem(item.path("uuid").asText(), item.path("version").asText())).thenReturn(item);
        var restored = scraper.parseMission(wolf, catalog).getFirst();
        assertThat(restored.getRewardUuid()).isEqualTo(item.path("uuid").asText());
        assertThat(restored.getRewardsText()).contains("Antium Helmet Midnight Sun");
    }
}
